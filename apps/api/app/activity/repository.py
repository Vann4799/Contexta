from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

import httpx

from app.core.postgrest import first_row
from app.activity.models import ActivityEvent, ActivityEventType


DEFAULT_ACTIVITY_LIMIT = 50
MAX_ACTIVITY_LIMIT = 200


def _event_id(seed: str) -> str:
    return str(uuid4())


def _document_event_type(status: str) -> ActivityEventType:
    mapping: dict[str, ActivityEventType] = {
        "uploaded": "document_uploaded",
        "processing": "document_processing",
        "ready": "document_ready",
        "failed": "document_failed",
        "trashed": "document_trashed",
    }
    return mapping.get(status, "document_uploaded")


def _document_title(filename: str, status: str) -> str:
    if status == "uploaded":
        return f"Uploaded {filename}"
    if status == "processing":
        return f"Started indexing {filename}"
    if status == "ready":
        return f"Finished indexing {filename}"
    if status == "failed":
        return f"Indexing failed for {filename}"
    if status == "trashed":
        return f"Moved {filename} to trash"
    return f"Document {filename} updated"


def _document_from_row(row: dict[str, object]) -> ActivityEvent:
    status = str(row.get("status", "uploaded"))
    filename = str(row.get("filename", "document"))
    return ActivityEvent(
        id=f"doc-{row['id']}-{status}",
        event_type=_document_event_type(status),
        user_id=str(row["user_id"]),
        title=_document_title(filename, status),
        description=f"Status: {status}",
        metadata={"document_id": row["id"], "filename": filename, "status": status},
        created_at=datetime.fromisoformat(str(row["updated_at"])),
    )


def _chat_message_from_row(row: dict[str, object]) -> ActivityEvent:
    content = str(row.get("content", ""))
    preview = content[:100] + "..." if len(content) > 100 else content
    return ActivityEvent(
        id=f"msg-{row['id']}",
        event_type="chat_message",
        user_id=str(row["user_id"]),
        title="Chat message",
        description=preview,
        metadata={"session_id": row.get("session_id"), "role": row.get("role")},
        created_at=datetime.fromisoformat(str(row["created_at"])),
    )


def _api_request_from_row(row: dict[str, object]) -> ActivityEvent:
    outcome = str(row.get("outcome", "allowed"))
    status_code = row.get("status_code", 0)
    return ActivityEvent(
        id=f"log-{row['id']}",
        event_type="api_request",
        user_id=str(row["user_id"]),
        title=f"API request ({outcome})",
        description=f"Status: {status_code}",
        metadata={"outcome": outcome, "status_code": status_code},
        created_at=datetime.fromisoformat(str(row["created_at"])),
    )


class ActivityRepository(Protocol):
    def list_events(
        self,
        user_id: str,
        limit: int = DEFAULT_ACTIVITY_LIMIT,
        offset: int = 0,
    ) -> tuple[list[ActivityEvent], int]:
        ...


class InMemoryActivityRepository:
    def __init__(self) -> None:
        self._events: list[ActivityEvent] = []

    def add_event(self, event: ActivityEvent) -> None:
        self._events.append(event)

    def list_events(
        self,
        user_id: str,
        limit: int = DEFAULT_ACTIVITY_LIMIT,
        offset: int = 0,
    ) -> tuple[list[ActivityEvent], int]:
        user_events = sorted(
            [e for e in self._events if e.user_id == user_id],
            key=lambda e: e.created_at,
            reverse=True,
        )
        total = len(user_events)
        return user_events[offset : offset + limit], total


class SupabaseActivityRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
        }

    def list_events(
        self,
        user_id: str,
        limit: int = DEFAULT_ACTIVITY_LIMIT,
        offset: int = 0,
    ) -> tuple[list[ActivityEvent], int]:
        documents_response = httpx.get(
            f"{self._supabase_url}/rest/v1/documents",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "order": "updated_at.desc",
                "limit": str(limit + offset),
            },
        )
        documents_response.raise_for_status()
        documents = documents_response.json()

        messages_response = httpx.get(
            f"{self._supabase_url}/rest/v1/chat_messages",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "role": "eq.user",
                "order": "created_at.desc",
                "limit": str(limit + offset),
            },
        )
        messages_response.raise_for_status()
        messages = messages_response.json()

        logs_response = httpx.get(
            f"{self._supabase_url}/rest/v1/api_request_logs",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
                "limit": str(limit + offset),
            },
        )
        logs_response.raise_for_status()
        logs = logs_response.json()

        events: list[ActivityEvent] = []
        events.extend(_document_from_row(doc) for doc in documents)
        events.extend(_chat_message_from_row(msg) for msg in messages)
        events.extend(_api_request_from_row(log) for log in logs)

        events.sort(key=lambda e: e.created_at, reverse=True)
        total = len(events)
        return events[offset : offset + limit], total


activity_repository = InMemoryActivityRepository()
