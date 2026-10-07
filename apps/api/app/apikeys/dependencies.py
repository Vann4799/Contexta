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

# An unknown key is a failed lookup, and an attacker with one IP can try many hashes
# against the same endpoint. This is not the quota -- the quota is authoritative in
# Postgres, per key. This only slows down guessing, so it is deliberately per IP,
# in-process, and approximate: with several workers each has its own counter, and a
# restart clears them.
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

    def finish(self, latency_ms: int, document_ids_hit: list[str]) -> None:
        """Attach timing and the documents actually served to the audit row.

        The response has already been decided by the time this runs, so a failed audit
        update must not turn a served request into an error. It is logged and dropped;
        the request itself stays counted because the authorize RPC already wrote it.
        """
        try:
            self.repository.record_outcome(self.log_id, latency_ms, document_ids_hit)
        except Exception:  # noqa: BLE001 - audit detail is best-effort by design
            logger.exception("could not finish api request log %s", self.log_id)


class _FailedLookupBudget:
    def __init__(self, limit: int, window_seconds: float) -> None:
        self._limit = limit
        self._window = window_seconds
        self._attempts: dict[str, list[float]] = {}

    def blocked(self, key: str) -> bool:
        cutoff = time.monotonic() - self._window
        attempts = [moment for moment in self._attempts.get(key, []) if moment >= cutoff]
        self._attempts[key] = attempts
        return len(attempts) >= self._limit

    def record(self, key: str) -> None:
        self._attempts.setdefault(key, []).append(time.monotonic())

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

    client_ip = request.client.host if request.client else "unknown"
    if _failed_lookups.blocked(client_ip):
        raise _reject(
            429,
            "too_many_failed_keys",
            "Too many unrecognized keys from this address.",
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
            _failed_lookups.record(client_ip)
        raise _authorization_error(authorization)

    if "retrieve" not in authorization.scopes:
        raise _reject(
            403,
            "insufficient_scope",
            "This key does not carry the retrieve scope.",
        )

    assert authorization.key_id is not None and authorization.user_id is not None
    return ApiKeyPrincipal(
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
