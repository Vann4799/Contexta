from contextlib import contextmanager
from dataclasses import dataclass, field
import logging
import time
from typing import Annotated, Iterator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.apikeys.models import KeyAuthorization
from app.apikeys.repository import (
    ApiKeyRepository,
    SupabaseApiKeyRepository,
    api_key_repository,
)
from app.apikeys.secrets import hash_api_key
from app.core.config import Settings, get_settings


logger = logging.getLogger(__name__)


def _store_detail(exc: Exception) -> str:
    """PostgREST's own words, which is the only useful thing to log here.

    The ambiguous-column bug in api_key_authorize was invisible in the API and spelled
    out in this body; class name alone would have sent me chasing a network timeout.
    """
    response = getattr(exc, "response", None)
    if response is not None:
        return f"{response.status_code} {response.text[:300]}"
    return f"{type(exc).__name__}: {exc}"


@contextmanager
def api_key_store() -> Iterator[None]:
    """Turn a key-store failure into a 503 the caller can actually read.

    An exception that escapes a route is answered by Starlette's ServerErrorMiddleware,
    which sits outside CORSMiddleware: the browser then reports "blocked by CORS policy"
    and the real cause is only in the server log.
    """
    try:
        yield
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - PostgREST failure must not leak internals
        logger.exception("api key store request failed: %s", _store_detail(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "api_key_store_unavailable",
                "message": "API key storage is unavailable. Retry shortly.",
            },
        ) from exc


# auto_error=False: FastAPI's built-in bearer error is a 403 with an unstructured detail,
# and this surface promises a 401 with a machine-readable code.
bearer_credentials = HTTPBearer(auto_error=False)

# An unknown key is a failed lookup, and one misconfigured client can retry the same bad
# key thousands of times, each retry costing a PostgREST round trip. This is not the quota
# -- the quota is authoritative in Postgres, per key. This only absorbs that retry storm,
# so it is keyed on the presented credential, in-process, and approximate: with several
# workers each has its own counter, and a restart clears them.
#
# It used to be per client address. uvicorn runs without --proxy-headers behind Caddy, so
# request.client.host is the proxy on every request and one caller's bad key could lock
# every other tenant out of /v1. Guessing is not what this defends against: a key carries
# ~160 bits, so no throttle is needed to make it infeasible.
FAILED_LOOKUP_LIMIT = 30
FAILED_LOOKUP_WINDOW_SECONDS = 60.0


@dataclass(frozen=True)
class ApiKeyPrincipal:
    """The identity a /v1 request is served as: a key, not a user session."""

    key_id: str
    user_id: str
    document_ids: list[str]
    scopes: list[str]
    remaining_minute: int
    remaining_day: int
    minute_limit: int
    day_limit: int
    log_id: int | None
    repository: ApiKeyRepository = field(compare=False, repr=False)

    def allows(self, document_id: str) -> bool:
        return not self.document_ids or document_id in self.document_ids


def finalize_api_request_log(request: Request, status_code: int) -> None:
    """Write the audit outcome once - and only once - the response status exists.

    ``authorize`` inserts the row while the request is still being admitted, so its
    ``status_code`` is the status of that decision. A key that authorized and then hit a
    404 or a 422 would otherwise stay logged as a success, and the owner's usage panel
    would report failures as served requests.
    """
    principal: ApiKeyPrincipal | None = getattr(request.state, "api_key_principal", None)
    if principal is None or principal.log_id is None:
        return

    started_at = getattr(request.state, "started_at", None)
    latency_ms = int((time.perf_counter() - started_at) * 1000) if started_at is not None else 0
    document_ids_hit: list[str] = getattr(request.state, "api_key_documents_hit", [])

    try:
        principal.repository.record_outcome(
            principal.log_id,
            latency_ms,
            document_ids_hit,
            status_code,
        )
    except Exception:  # noqa: BLE001 - audit detail is best-effort by design
        # The client already has its answer; a failed audit write must not become an error,
        # and the request stays counted because the authorize RPC wrote it.
        logger.exception("could not finish api request log %s", principal.log_id)


class _FailedLookupBudget:
    def __init__(self, limit: int, window_seconds: float, tracked_limit: int = 10_000) -> None:
        self._limit = limit
        self._window = window_seconds
        self._tracked_limit = tracked_limit
        self._attempts: dict[str, list[float]] = {}

    def blocked(self, key: str) -> bool:
        cutoff = time.monotonic() - self._window
        attempts = [moment for moment in self._attempts.get(key, []) if moment >= cutoff]
        self._attempts[key] = attempts
        return len(attempts) >= self._limit

    def record(self, key: str) -> None:
        self._attempts.setdefault(key, []).append(time.monotonic())
        if len(self._attempts) > self._tracked_limit:
            self._forget_expired()

    def _forget_expired(self) -> None:
        cutoff = time.monotonic() - self._window
        live: dict[str, list[float]] = {}
        for name, attempts in self._attempts.items():
            recent = [moment for moment in attempts if moment >= cutoff]
            if recent:
                live[name] = recent
        self._attempts = live

    def reset(self) -> None:
        self._attempts.clear()


_failed_lookups = _FailedLookupBudget(FAILED_LOOKUP_LIMIT, FAILED_LOOKUP_WINDOW_SECONDS)


def get_api_key_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ApiKeyRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseApiKeyRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return api_key_repository


def get_api_key_principal(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    repository: Annotated[ApiKeyRepository, Depends(get_api_key_repository)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_credentials)],
) -> ApiKeyPrincipal:
    """Authorize a machine key. Never reuse get_current_user here.

    A Supabase JWT and an API key both arrive in Authorization: Bearer, so a shared
    dependency would either accept browser sessions on the metered surface or reject real
    keys -- and it would make every /v1 quota bypassable with a login token.
    """
    if credentials is None or not credentials.credentials:
        raise _reject(
            401,
            "invalid_api_key",
            "Provide a Contexta API key in the Authorization header.",
        )

    credential_bucket = hash_api_key(credentials.credentials)
    if _failed_lookups.blocked(credential_bucket):
        raise _reject(
            429,
            "too_many_failed_keys",
            "Too many rejected attempts with this key.",
            headers={"Retry-After": str(int(FAILED_LOOKUP_WINDOW_SECONDS))},
        )

    try:
        authorization = repository.authorize(
            credentials.credentials,
            settings.api_key_minute_limit,
            settings.api_key_day_limit,
        )
    except Exception as exc:  # noqa: BLE001 - PostgREST failure must not leak internals
        # Without this line the host shows a 503 and no cause, and the only way to find
        # out what PostgREST said is to reproduce the call by hand.
        logger.exception("api key authorization failed: %s", _store_detail(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "api_key_store_unavailable",
                "message": "API key authorization is unavailable. Retry shortly.",
            },
        ) from exc

    if authorization.outcome != "allowed":
        if authorization.outcome == "invalid":
            _failed_lookups.record(credential_bucket)
        raise _authorization_error(authorization)

    if "retrieve" not in authorization.scopes:
        raise _reject(
            403,
            "insufficient_scope",
            "This key does not carry the retrieve scope.",
        )

    assert authorization.key_id is not None and authorization.user_id is not None
    principal = ApiKeyPrincipal(
        key_id=authorization.key_id,
        user_id=authorization.user_id,
        document_ids=list(authorization.document_ids),
        scopes=list(authorization.scopes),
        remaining_minute=authorization.remaining_minute,
        remaining_day=authorization.remaining_day,
        minute_limit=settings.api_key_minute_limit,
        day_limit=settings.api_key_day_limit,
        log_id=authorization.log_id,
        repository=repository,
    )
    # The finalizer runs after the route returns, where only the request is in scope.
    request.state.api_key_principal = principal
    return principal


def quota_headers(principal: ApiKeyPrincipal) -> dict[str, str]:
    return {
        "X-RateLimit-Limit-Minute": str(principal.minute_limit),
        "X-RateLimit-Remaining-Minute": str(principal.remaining_minute),
        "X-RateLimit-Limit-Day": str(principal.day_limit),
        "X-RateLimit-Remaining-Day": str(principal.remaining_day),
    }


def _authorization_error(authorization: KeyAuthorization) -> HTTPException:
    messages = {
        "invalid": "The API key is not recognized.",
        "revoked": "This API key has been revoked.",
        "expired": "This API key has expired.",
        "quota_minute": "Per-minute request limit reached for this API key.",
        "quota_day": "Daily request limit reached for this API key.",
    }
    codes = {
        "invalid": "invalid_api_key",
        "revoked": "api_key_revoked",
        "expired": "api_key_expired",
        "quota_minute": "quota_minute_exceeded",
        "quota_day": "quota_day_exceeded",
    }
    headers: dict[str, str] = {}
    if authorization.status_code == 429:
        headers["Retry-After"] = str(seconds_to_next_minute())

    return _reject(
        authorization.status_code,
        codes[authorization.outcome],
        messages[authorization.outcome],
        headers=headers or None,
    )


def seconds_to_next_minute(now: float | None = None) -> int:
    moment = now if now is not None else time.time()
    return max(1, int(60 - (moment % 60)))


def _reject(
    status_code: int,
    code: str,
    message: str,
    headers: dict[str, str] | None = None,
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
        headers=headers,
    )
