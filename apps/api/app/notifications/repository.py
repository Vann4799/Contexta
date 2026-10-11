from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

import httpx

from app.core.postgrest import first_row
from app.notifications.models import Notification, NotificationType


DEFAULT_NOTIFICATION_LIMIT = 20


class NotificationRepository(Protocol):
    def list_notifications(
        self,
        user_id: str,
        limit: int = DEFAULT_NOTIFICATION_LIMIT,
    ) -> tuple[list[Notification], int]:
        ...

    def mark_read(self, user_id: str, notification_id: str) -> Notification | None:
        ...

    def mark_all_read(self, user_id: str) -> None:
        ...

    def create_notification(
        self,
        user_id: str,
        type: NotificationType,
        title: str,
        message: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> Notification:
        ...


class InMemoryNotificationRepository:
    def __init__(self) -> None:
        self._notifications: list[Notification] = []

    def list_notifications(
        self,
        user_id: str,
        limit: int = DEFAULT_NOTIFICATION_LIMIT,
    ) -> tuple[list[Notification], int]:
        user_notifications = sorted(
            [n for n in self._notifications if n.user_id == user_id],
            key=lambda n: n.created_at,
            reverse=True,
        )
        unread_count = sum(1 for n in user_notifications if not n.read)
        return user_notifications[:limit], unread_count

    def mark_read(self, user_id: str, notification_id: str) -> Notification | None:
        for index, notification in enumerate(self._notifications):
            if notification.id == notification_id and notification.user_id == user_id:
                updated = notification.model_copy(update={"read": True})
                self._notifications[index] = updated
                return updated
        return None

    def mark_all_read(self, user_id: str) -> None:
        for index, notification in enumerate(self._notifications):
            if notification.user_id == user_id and not notification.read:
                self._notifications[index] = notification.model_copy(update={"read": True})

    def create_notification(
        self,
        user_id: str,
        type: NotificationType,
        title: str,
        message: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> Notification:
        notification = Notification(
            id=str(uuid4()),
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            metadata=metadata,
            read=False,
            created_at=datetime.now(timezone.utc),
        )
        self._notifications.append(notification)
        return notification


class SupabaseNotificationRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
        }

    def list_notifications(
        self,
        user_id: str,
        limit: int = DEFAULT_NOTIFICATION_LIMIT,
    ) -> tuple[list[Notification], int]:
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/notifications",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
        response.raise_for_status()
        notifications = [
            Notification.model_validate(row) for row in response.json()
        ]
        unread_count = sum(1 for n in notifications if not n.read)
        return notifications, unread_count

    def mark_read(self, user_id: str, notification_id: str) -> Notification | None:
        headers = {
            **self._headers,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        response = httpx.patch(
            f"{self._supabase_url}/rest/v1/notifications",
            headers=headers,
            params={
                "id": f"eq.{notification_id}",
                "user_id": f"eq.{user_id}",
            },
            json={"read": True},
        )
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return None
        return Notification.model_validate(rows[0])

    def mark_all_read(self, user_id: str) -> None:
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/rpc/mark_all_notifications_read",
            headers={**self._headers, "Content-Type": "application/json"},
            json={"p_user_id": user_id},
        )
        response.raise_for_status()

    def create_notification(
        self,
        user_id: str,
        type: NotificationType,
        title: str,
        message: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> Notification:
        headers = {
            **self._headers,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        payload = {
            "user_id": user_id,
            "type": type,
            "title": title,
            "message": message,
            "metadata": metadata or {},
        }
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/notifications",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        return Notification.model_validate(first_row(response.json(), "notification"))


notification_repository = InMemoryNotificationRepository()
