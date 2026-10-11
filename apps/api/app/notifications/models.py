from datetime import datetime
from typing import Literal

from pydantic import BaseModel


NotificationType = Literal["document_ready", "document_failed", "quota_warning", "system"]


class Notification(BaseModel):
    id: str
    user_id: str
    type: NotificationType
    title: str
    message: str | None = None
    metadata: dict[str, object] | None = None
    read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[Notification]
    unread_count: int
