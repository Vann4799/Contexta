from datetime import datetime
from typing import Literal

from pydantic import BaseModel


ActivityEventType = Literal[
    "document_uploaded",
    "document_processing",
    "document_ready",
    "document_failed",
    "document_trashed",
    "chat_message",
    "api_request",
]


class ActivityEvent(BaseModel):
    id: str
    event_type: ActivityEventType
    user_id: str
    title: str
    description: str | None = None
    metadata: dict[str, object] | None = None
    created_at: datetime


class ActivityFeedResponse(BaseModel):
    events: list[ActivityEvent]
    total: int
    has_more: bool
