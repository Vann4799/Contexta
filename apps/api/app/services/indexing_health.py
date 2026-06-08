from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import httpx
from pydantic import BaseModel

from app.core.config import Settings
from app.documents.repository import document_repository


IndexingHealthStatus = Literal["ok", "attention"]
IndexingHealthSource = Literal["supabase", "in_memory", "unknown"]
STALE_PROCESSING_AFTER_MINUTES = 10


class IndexingHealthResponse(BaseModel):
    status: IndexingHealthStatus
    service: str = "indexing"
    source: IndexingHealthSource
    processing_documents: int
    queued_documents: int
    stale_processing_documents: int
    stale_after_minutes: int
    checked_at: datetime


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def build_indexing_health(
    rows: list[dict[str, Any]],
    *,
    source: IndexingHealthSource,
    now: datetime | None = None,
    stale_after_minutes: int = STALE_PROCESSING_AFTER_MINUTES,
) -> IndexingHealthResponse:
    checked_at = now or datetime.now(timezone.utc)
    checked_at = checked_at.astimezone(timezone.utc)
    stale_before = checked_at - timedelta(minutes=stale_after_minutes)
    processing_rows = [row for row in rows if row.get("status") == "processing"]
    queued_rows = [row for row in rows if row.get("status") == "uploaded"]
    stale_rows = []

    for row in processing_rows:
        processing_at = _parse_datetime(row.get("processing_started_at"))
        updated_at = _parse_datetime(row.get("updated_at"))
        latest_signal = max(
            [value for value in (processing_at, updated_at) if value is not None],
            default=None,
        )
        if latest_signal is not None and latest_signal < stale_before:
            stale_rows.append(row)

    return IndexingHealthResponse(
        status="attention" if stale_rows else "ok",
        source=source,
        processing_documents=len(processing_rows),
        queued_documents=len(queued_rows),
        stale_processing_documents=len(stale_rows),
        stale_after_minutes=stale_after_minutes,
        checked_at=checked_at,
    )


def check_indexing_health(settings: Settings) -> IndexingHealthResponse:
    if settings.supabase_url and settings.supabase_service_role_key:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/documents",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
            params={
                "select": "status,updated_at,processing_started_at",
                "status": "in.(uploaded,processing)",
            },
        )
        response.raise_for_status()
        return build_indexing_health(response.json(), source="supabase")

    rows = [
        document.model_dump()
        for document in getattr(document_repository, "_documents", [])
    ]
    if rows:
        return build_indexing_health(rows, source="in_memory")

    return build_indexing_health([], source="unknown")
