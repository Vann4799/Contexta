from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

import httpx

from app.chat.models import ChatCitation, ChatMessageResponse, ChatSessionResponse
from app.core.ids import is_uuid


class ChatRepository(Protocol):
    def list_sessions(self, user_id: str) -> list[ChatSessionResponse]:
        ...

    def create_session(self, user_id: str, title: str = "New chat") -> ChatSessionResponse:
        ...

    def get_session(self, user_id: str, session_id: str) -> ChatSessionResponse | None:
        ...

    def list_messages(self, user_id: str, session_id: str) -> list[ChatMessageResponse]:
        ...

    def create_message(
        self,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        citations: list[ChatCitation] | None = None,
        metadata: dict[str, object] | None = None,
    ) -> ChatMessageResponse:
        ...

    def update_session_activity(
        self,
        user_id: str,
        session_id: str,
        title: str | None = None,
    ) -> ChatSessionResponse | None:
        ...


class InMemoryChatRepository:
    def __init__(self) -> None:
        self._sessions: list[ChatSessionResponse] = []
        self._messages: list[ChatMessageResponse] = []

    def list_sessions(self, user_id: str) -> list[ChatSessionResponse]:
        return [
            session
            for session in sorted(
                self._sessions,
                key=lambda item: item.updated_at,
                reverse=True,
            )
            if session.user_id == user_id
        ]

    def create_session(self, user_id: str, title: str = "New chat") -> ChatSessionResponse:
        now = datetime.now(timezone.utc).isoformat()
        session = ChatSessionResponse(
            id=str(uuid4()),
            user_id=user_id,
            title=title,
            created_at=now,
            updated_at=now,
        )
        self._sessions.append(session)
        return session

    def get_session(self, user_id: str, session_id: str) -> ChatSessionResponse | None:
        for session in self._sessions:
            if session.id == session_id and session.user_id == user_id:
                return session
        return None

    def list_messages(self, user_id: str, session_id: str) -> list[ChatMessageResponse]:
        return [
            message
            for message in self._messages
            if message.user_id == user_id and message.session_id == session_id
        ]

    def create_message(
        self,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        citations: list[ChatCitation] | None = None,
        metadata: dict[str, object] | None = None,
    ) -> ChatMessageResponse:
        now = datetime.now(timezone.utc).isoformat()
        message = ChatMessageResponse(
            id=str(uuid4()),
            session_id=session_id,
            user_id=user_id,
            role=role,
            content=content,
            citations=citations or [],
            metadata=metadata or {},
            created_at=now,
        )
        self._messages.append(message)
        return message

    def update_session_activity(
        self,
        user_id: str,
        session_id: str,
        title: str | None = None,
    ) -> ChatSessionResponse | None:
        now = datetime.now(timezone.utc).isoformat()
        for index, session in enumerate(self._sessions):
            if session.id == session_id and session.user_id == user_id:
                updated = session.model_copy(
                    update={
                        "title": title or session.title,
                        "updated_at": now,
                    }
                )
                self._sessions[index] = updated
                return updated
        return None


class SupabaseChatRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
            "User-Agent": "ContextaAPI/1.0",
        }

    def list_sessions(self, user_id: str) -> list[ChatSessionResponse]:
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/chat_sessions",
            headers=self._headers,
            params={"user_id": f"eq.{user_id}", "order": "updated_at.desc"},
        )
        response.raise_for_status()
        return [ChatSessionResponse.model_validate(item) for item in response.json()]

    def create_session(self, user_id: str, title: str = "New chat") -> ChatSessionResponse:
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/chat_sessions",
            headers={
                **self._headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={"user_id": user_id, "title": title},
        )
        response.raise_for_status()
        created = response.json()
        if isinstance(created, list):
            created = created[0]
        return ChatSessionResponse.model_validate(created)

    def get_session(self, user_id: str, session_id: str) -> ChatSessionResponse | None:
        # chat_sessions.id is a Postgres uuid; a malformed id is not a lookup that
        # misses, it is a filter PostgREST refuses to build (400/22P02 -> 500).
        if not is_uuid(session_id):
            return None
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/chat_sessions",
            headers=self._headers,
            params={
                "id": f"eq.{session_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
        )
        response.raise_for_status()
        sessions = response.json()
        if not sessions:
            return None
        return ChatSessionResponse.model_validate(sessions[0])

    def list_messages(self, user_id: str, session_id: str) -> list[ChatMessageResponse]:
        if not is_uuid(session_id):
            return []
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/chat_messages",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "session_id": f"eq.{session_id}",
                "order": "created_at.asc",
            },
        )
        response.raise_for_status()
        return [ChatMessageResponse.model_validate(item) for item in response.json()]

    def create_message(
        self,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        citations: list[ChatCitation] | None = None,
        metadata: dict[str, object] | None = None,
    ) -> ChatMessageResponse:
        payload = {
            "user_id": user_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "citations": [
                citation.model_dump(mode="json") for citation in citations or []
            ],
            "metadata": metadata or {},
        }
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/chat_messages",
            headers={
                **self._headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=payload,
        )
        response.raise_for_status()
        created = response.json()
        if isinstance(created, list):
            created = created[0]
        return ChatMessageResponse.model_validate(created)

    def update_session_activity(
        self,
        user_id: str,
        session_id: str,
        title: str | None = None,
    ) -> ChatSessionResponse | None:
        payload: dict[str, str] = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if title:
            payload["title"] = title

        response = httpx.patch(
            f"{self._supabase_url}/rest/v1/chat_sessions",
            headers={
                **self._headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{session_id}",
                "user_id": f"eq.{user_id}",
            },
            json=payload,
        )
        response.raise_for_status()
        sessions = response.json()
        if not sessions:
            return None
        return ChatSessionResponse.model_validate(sessions[0])


chat_repository = InMemoryChatRepository()
