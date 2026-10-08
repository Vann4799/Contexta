from datetime import datetime, timedelta, timezone
from typing import Callable, Protocol

import httpx

from app.apikeys.models import ApiKeyOutcome, KeyAuthorization
from app.apikeys.secrets import hash_api_key
from app.core.ids import is_uuid
from app.core.postgrest import first_row


class ApiKeyRepository(Protocol):
    def create_key(
        self,
        user_id: str,
        name: str,
        key_hash: str,
        key_prefix: str,
        last_four: str,
        document_ids: list[str],
        scopes: list[str],
        expires_at: datetime | None,
    ) -> "ApiKeyRow":
        ...

    def list_keys(self, user_id: str) -> list["ApiKeyRow"]:
        ...

    def get_key(self, user_id: str, key_id: str) -> "ApiKeyRow | None":
        ...

    def revoke_key(self, user_id: str, key_id: str) -> "ApiKeyRow | None":
        ...

    def authorize(
        self,
        plaintext_key: str,
        minute_limit: int,
        day_limit: int,
    ) -> KeyAuthorization:
        ...

    def record_outcome(
        self,
        log_id: int | None,
        latency_ms: int,
        document_ids_hit: list[str],
        status_code: int,
    ) -> None:
        ...

    def usage(self, user_id: str, key_id: str, days: int) -> dict[str, object]:
        ...

    def prune_logs(self, retention_days: int) -> int:
        ...


class ApiKeyRow(dict):
    """A key row as the repository returns it, minus the secret, which never exists here."""


def _row(value: dict[str, object]) -> ApiKeyRow:
    row = ApiKeyRow(value)
    row["user_id"] = str(row.get("user_id") or "")
    row["id"] = str(row["id"])
    row["document_ids"] = list(row.get("document_ids") or [])
    row["scopes"] = list(row.get("scopes") or [])
    # PostgREST hands back ISO strings where InMemory holds datetimes; the two have to be
    # interchangeable or every comparison works in tests and fails in production.
    for field in ("revoked_at", "expires_at", "last_used_at", "created_at"):
        row[field] = _timestamp(row.get(field))
    return row


def _timestamp(value: object) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _now() -> datetime:
    return datetime.now(timezone.utc)


class InMemoryApiKeyRepository:
    """Mirrors the RPC's decision table so tests exercise the same branches as production."""

    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        # Injectable so quota tests can move the clock forward instead of sleeping.
        self._now = clock or _now
        self._keys: list[ApiKeyRow] = []
        self._logs: list[dict[str, object]] = []
        self._next_log_id = 1

    def create_key(
        self,
        user_id: str,
        name: str,
        key_hash: str,
        key_prefix: str,
        last_four: str,
        document_ids: list[str],
        scopes: list[str],
        expires_at: datetime | None,
    ) -> ApiKeyRow:
        row = ApiKeyRow(
            {
                "id": f"key-{len(self._keys) + 1}",
                "user_id": user_id,
                "name": name,
                "key_hash": key_hash,
                "key_prefix": key_prefix,
                "last_four": last_four,
                "document_ids": list(document_ids),
                "scopes": list(scopes),
                "revoked_at": None,
                "expires_at": expires_at,
                "last_used_at": None,
                "created_at": self._now(),
            }
        )
        self._keys.append(row)
        return row

    def list_keys(self, user_id: str) -> list[ApiKeyRow]:
        return [key for key in self._keys if key["user_id"] == user_id]

    def get_key(self, user_id: str, key_id: str) -> ApiKeyRow | None:
        for key in self._keys:
            if key["user_id"] == user_id and key["id"] == key_id:
                return key
        return None

    def revoke_key(self, user_id: str, key_id: str) -> ApiKeyRow | None:
        for index, key in enumerate(self._keys):
            if key["user_id"] == user_id and key["id"] == key_id:
                if key["revoked_at"] is None:
                    self._keys[index] = ApiKeyRow({**key, "revoked_at": self._now()})
                return self._keys[index]
        return None

    def authorize(
        self,
        plaintext_key: str,
        minute_limit: int,
        day_limit: int,
    ) -> KeyAuthorization:
        key_hash = hash_api_key(plaintext_key)
        key = next((item for item in self._keys if item["key_hash"] == key_hash), None)

        if key is None:
            log_id = self._log(None, None, "invalid", 401)
            return KeyAuthorization(
                key_id=None,
                user_id=None,
                document_ids=[],
                scopes=[],
                outcome="invalid",
                status_code=401,
                remaining_minute=0,
                remaining_day=0,
                log_id=log_id,
            )

        if key["revoked_at"] is not None:
            outcome, status_code = "revoked", 403
            used_minute, used_day = 0, 0
        elif key["expires_at"] is not None and key["expires_at"] <= self._now():
            outcome, status_code = "expired", 403
            used_minute, used_day = 0, 0
        else:
            used_minute = self._used(key["id"], "minute")
            used_day = self._used(key["id"], "day")
            if used_minute >= minute_limit:
                outcome, status_code = "quota_minute", 429
            elif used_day >= day_limit:
                outcome, status_code = "quota_day", 429
            else:
                outcome, status_code = "allowed", 200

        log_id = self._log(key["id"], key["user_id"], outcome, status_code)

        if outcome == "allowed":
            for index, item in enumerate(self._keys):
                if item["id"] == key["id"]:
                    self._keys[index] = ApiKeyRow({**item, "last_used_at": self._now()})

        return KeyAuthorization(
            key_id=key["id"],
            user_id=key["user_id"],
            document_ids=list(key["document_ids"]),
            scopes=list(key["scopes"]),
            outcome=outcome,
            status_code=status_code,
            remaining_minute=max(minute_limit - (used_minute + 1), 0)
            if outcome == "allowed"
            else 0,
            remaining_day=max(day_limit - (used_day + 1), 0)
            if outcome == "allowed"
            else 0,
            log_id=log_id,
        )

    def _used(self, key_id: str, window: str) -> int:
        if window == "minute":
            floor = self._now().replace(second=0, microsecond=0)
        else:
            floor = self._now().replace(hour=0, minute=0, second=0, microsecond=0)
        return sum(
            1
            for log in self._logs
            if log["key_id"] == key_id
            and log["outcome"] == "allowed"
            and log["created_at"] >= floor
        )

    def _log(
        self,
        key_id: str | None,
        user_id: str | None,
        outcome: ApiKeyOutcome,
        status_code: int,
    ) -> int:
        log_id = self._next_log_id
        self._next_log_id += 1
        self._logs.append(
            {
                "id": log_id,
                "key_id": key_id,
                "user_id": user_id,
                "outcome": outcome,
                "status_code": status_code,
                "latency_ms": None,
                "document_ids_hit": [],
                "created_at": self._now(),
            }
        )
        return log_id

    def record_outcome(
        self,
        log_id: int | None,
        latency_ms: int,
        document_ids_hit: list[str],
        status_code: int,
    ) -> None:
        for index, log in enumerate(self._logs):
            if log["id"] == log_id:
                self._logs[index] = {
                    **log,
                    "latency_ms": latency_ms,
                    "document_ids_hit": list(document_ids_hit),
                    "status_code": status_code,
                }
                return

    def usage(self, user_id: str, key_id: str, days: int) -> dict[str, object]:
        by_day: dict[str, dict[str, int]] = {}
        for offset in range(days - 1, -1, -1):
            day = (self._now() - timedelta(days=offset)).strftime("%Y-%m-%d")
            by_day[day] = {"date": day, "allowed": 0, "rejected": 0}

        # One window for every figure: counting the whole history here while by_day
        # respected `days` is the divergence the live RPC had too.
        logs = [log for log in self._logs if log["key_id"] == key_id and str(log["created_at"])[:10] in by_day]

        by_outcome: dict[str, int] = {}
        for log in logs:
            outcome = str(log["outcome"])
            by_outcome[outcome] = by_outcome.get(outcome, 0) + 1
            bucket = by_day.get(str(log["created_at"])[:10])
            if bucket is not None:
                bucket["allowed" if outcome == "allowed" else "rejected"] += 1

        allowed = by_outcome.get("allowed", 0)
        return {
            "key_id": key_id,
            "days": days,
            "total": len(logs),
            "allowed": allowed,
            "rejected": len(logs) - allowed,
            "by_outcome": by_outcome,
            "by_day": list(by_day.values()),
        }

    def prune_logs(self, retention_days: int) -> int:
        floor = self._now() - timedelta(days=retention_days)
        before = len(self._logs)
        self._logs = [log for log in self._logs if log["created_at"] >= floor]
        return before - len(self._logs)


class SupabaseApiKeyRepository:
    """PostgREST only, so quota arithmetic has to live inside one RPC call.

    A count-then-insert pair over HTTP is not atomic: two concurrent requests would both
    read "99 used" and both allow a hundredth. api_key_authorize takes the row lock,
    counts, decides, and writes the audit row in a single round trip.
    """

    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
        }

    def create_key(
        self,
        user_id: str,
        name: str,
        key_hash: str,
        key_prefix: str,
        last_four: str,
        document_ids: list[str],
        scopes: list[str],
        expires_at: datetime | None,
    ) -> ApiKeyRow:
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/api_keys",
            headers={
                **self._headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={
                "user_id": user_id,
                "name": name,
                "key_hash": key_hash,
                "key_prefix": key_prefix,
                "last_four": last_four,
                "document_ids": document_ids,
                "scopes": scopes,
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
        )
        response.raise_for_status()
        created = response.json()
        return _row(first_row(created, "api key"))

    def list_keys(self, user_id: str) -> list[ApiKeyRow]:
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/api_keys",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
            },
        )
        response.raise_for_status()
        return [_row(key) for key in response.json()]

    def get_key(self, user_id: str, key_id: str) -> ApiKeyRow | None:
        # api_keys.id is a Postgres uuid; a malformed id is a filter PostgREST refuses
        # to build (400/22P02), not a lookup that misses.
        if not is_uuid(key_id):
            return None
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/api_keys",
            headers=self._headers,
            params={
                "id": f"eq.{key_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
        )
        response.raise_for_status()
        keys = response.json()
        return _row(keys[0]) if keys else None

    def revoke_key(self, user_id: str, key_id: str) -> ApiKeyRow | None:
        if not is_uuid(key_id):
            return None
        response = httpx.patch(
            f"{self._supabase_url}/rest/v1/api_keys",
            headers={
                **self._headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{key_id}",
                "user_id": f"eq.{user_id}",
                "revoked_at": "is.null",
            },
            json={"revoked_at": _now().isoformat()},
        )
        response.raise_for_status()
        revoked = response.json()
        if revoked:
            return _row(revoked[0])
        # The guard matched nothing, which means either "already revoked" or "not this
        # user's key to revoke" -- PostgREST cannot tell those apart. Reading the row back
        # does: it comes back with revoked_at set (200) or not at all (404).
        return self.get_key(user_id, key_id)

    def authorize(
        self,
        plaintext_key: str,
        minute_limit: int,
        day_limit: int,
    ) -> KeyAuthorization:
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/rpc/api_key_authorize",
            headers={**self._headers, "Content-Type": "application/json"},
            json={
                "p_key_hash": hash_api_key(plaintext_key),
                "p_minute_limit": minute_limit,
                "p_day_limit": day_limit,
            },
        )
        response.raise_for_status()
        return KeyAuthorization.model_validate(response.json())

    def record_outcome(
        self,
        log_id: int | None,
        latency_ms: int,
        document_ids_hit: list[str],
        status_code: int,
    ) -> None:
        if log_id is None:
            return
        response = httpx.patch(
            f"{self._supabase_url}/rest/v1/api_request_logs",
            headers={**self._headers, "Content-Type": "application/json"},
            params={"id": f"eq.{log_id}"},
            json={
                "latency_ms": latency_ms,
                "document_ids_hit": document_ids_hit,
                "status_code": status_code,
            },
        )
        response.raise_for_status()

    def usage(self, user_id: str, key_id: str, days: int) -> dict[str, object]:
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/rpc/api_key_usage",
            headers={**self._headers, "Content-Type": "application/json"},
            json={"p_key_id": key_id, "p_days": days},
        )
        response.raise_for_status()
        return dict(response.json())

    def prune_logs(self, retention_days: int) -> int:
        floor = _now() - timedelta(days=retention_days)
        response = httpx.delete(
            f"{self._supabase_url}/rest/v1/api_request_logs",
            headers={**self._headers, "Prefer": "count=exact"},
            params={"created_at": f"lt.{floor.isoformat()}"},
        )
        response.raise_for_status()
        return _count_from_content_range(response.headers.get("content-range"))


def _count_from_content_range(header: str | None) -> int:
    # PostgREST reports the affected row count in Content-Range only when Prefer: count
    # is sent; the body of a DELETE is empty.
    if not header or "/" not in header:
        return 0
    try:
        return int(header.rsplit("/", 1)[1])
    except ValueError:
        return 0


api_key_repository = InMemoryApiKeyRepository()
