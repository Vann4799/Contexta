from datetime import datetime, timedelta, timezone
from typing import Callable, Protocol

import httpx


ACTIVITY_WINDOW_DAYS = 7
KEY_USAGE_WINDOW_DAYS = 14

DOCUMENT_STATUSES = ("uploaded", "processing", "ready", "failed")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AccountRepository(Protocol):
    def summary(self, user_id: str) -> dict[str, object]:
        ...


class InMemoryAccountRepository:
    """Re-implements the account_summary RPC in Python over plain row lists.

    The live figure comes from SQL the API cannot test, so this mirror is what the route and
    the browser contract are tested against. Keep it in step with
    infra/supabase/migrations/0004_account_summary.sql - the rules that have to agree are the
    window lengths, chunks counted from chunk rows rather than documents.chunk_count, chats
    limited to role 'user', sessions counted from chat_sessions rows, keys excluding revoked and
    expired, and the doc_type tie-break.
    """

    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        self._now = clock or _now
        self._documents: list[dict[str, object]] = []
        self._chunks: list[dict[str, object]] = []
        self._sessions: list[dict[str, object]] = []
        self._messages: list[dict[str, object]] = []
        self._keys: list[dict[str, object]] = []
        self._logs: list[dict[str, object]] = []

    def add_document(
        self,
        user_id: str,
        status: str,
        doc_type: str,
        file_size: int,
        created_at: datetime,
    ) -> None:
        self._documents.append(
            {
                "user_id": user_id,
                "status": status,
                "doc_type": doc_type,
                "file_size": file_size,
                "created_at": created_at,
            }
        )

    def add_chunk(self, user_id: str, created_at: datetime) -> None:
        self._chunks.append({"user_id": user_id, "created_at": created_at})

    def add_session(self, user_id: str) -> None:
        self._sessions.append({"user_id": user_id})

    def add_message(self, user_id: str, role: str, created_at: datetime) -> None:
        self._messages.append({"user_id": user_id, "role": role, "created_at": created_at})

    def add_api_key(
        self,
        user_id: str,
        revoked_at: datetime | None = None,
        expires_at: datetime | None = None,
    ) -> None:
        self._keys.append(
            {"user_id": user_id, "revoked_at": revoked_at, "expires_at": expires_at}
        )

    def add_log(self, user_id: str, created_at: datetime) -> None:
        self._logs.append({"user_id": user_id, "created_at": created_at})

    def summary(self, user_id: str) -> dict[str, object]:
        now = self._now()
        activity_floor = now - timedelta(days=ACTIVITY_WINDOW_DAYS)
        usage_floor = now - timedelta(days=KEY_USAGE_WINDOW_DAYS)

        documents = [row for row in self._documents if row["user_id"] == user_id]
        chunks = [row for row in self._chunks if row["user_id"] == user_id]
        messages = [row for row in self._messages if row["user_id"] == user_id]
        sessions = [row for row in self._sessions if row["user_id"] == user_id]

        by_status = {status: 0 for status in DOCUMENT_STATUSES}
        for row in documents:
            by_status[str(row["status"])] = by_status.get(str(row["status"]), 0) + 1

        # Grouped, then ordered by count desc and the oldest document of the type, matching
        # the RPC so a tie names the same doc_type in tests and in production.
        by_type: dict[str, list[datetime]] = {}
        for row in documents:
            by_type.setdefault(str(row["doc_type"]), []).append(row["created_at"])  # type: ignore[arg-type]
        top_doc_type = None
        if by_type:
            winner = min(
                by_type.items(),
                key=lambda item: (-len(item[1]), min(item[1])),
            )
            top_doc_type = {"doc_type": winner[0], "documents": len(winner[1])}

        return {
            "documents": {"total": len(documents), "by_status": by_status},
            "chunks": len(chunks),
            "storage_bytes": sum(int(row["file_size"]) for row in documents),
            "top_doc_type": top_doc_type,
            "sessions": len(sessions),
            "activity": {
                "uploads_7d": sum(1 for row in documents if row["created_at"] >= activity_floor),
                "indexed_7d": sum(1 for row in chunks if row["created_at"] >= activity_floor),
                "chats_7d": sum(
                    1
                    for row in messages
                    if row["role"] == "user" and row["created_at"] >= activity_floor
                ),
                "last_upload_at": _stamp(documents, "created_at"),
                "last_index_at": _stamp(chunks, "created_at"),
                "last_chat_at": _stamp(messages, "created_at"),
            },
            "developer": {
                "api_keys_active": sum(
                    1
                    for key in self._keys
                    if key["user_id"] == user_id
                    and key["revoked_at"] is None
                    and (key["expires_at"] is None or key["expires_at"] > now)  # type: ignore[operator]
                ),
                "api_requests_14d": sum(
                    1 for log in self._logs if log["user_id"] == user_id and log["created_at"] >= usage_floor  # type: ignore[operator]
                ),
            },
        }


def _stamp(rows: list[dict[str, object]], field: str) -> str | None:
    values = [row[field] for row in rows if row.get(field) is not None]
    if not values:
        return None
    return max(values).isoformat()  # type: ignore[union-attr]


class SupabaseAccountRepository:
    """One RPC read. PostgREST has no GROUP BY, so the counting lives in account_summary()."""

    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
            "Content-Type": "application/json",
        }

    def summary(self, user_id: str) -> dict[str, object]:
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/rpc/account_summary",
            headers=self._headers,
            json={"p_user_id": user_id},
        )
        response.raise_for_status()
        return dict(response.json())


account_repository = InMemoryAccountRepository()
