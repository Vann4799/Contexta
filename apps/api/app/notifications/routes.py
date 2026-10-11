from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings
from app.notifications.models import Notification, NotificationListResponse
from app.notifications.repository import (
    NotificationRepository,
    SupabaseNotificationRepository,
    notification_repository,
    DEFAULT_NOTIFICATION_LIMIT,
)


router = APIRouter(prefix="/notifications", tags=["notifications"])


def get_notification_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> NotificationRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseNotificationRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return notification_repository


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[NotificationRepository, Depends(get_notification_repository)],
    limit: Annotated[int, Query(ge=1, le=100)] = DEFAULT_NOTIFICATION_LIMIT,
) -> NotificationListResponse:
    notifications, unread_count = repository.list_notifications(current_user.id, limit)
    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read", response_model=Notification)
def mark_notification_read(
    notification_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[NotificationRepository, Depends(get_notification_repository)],
) -> Notification:
    updated = repository.mark_read(current_user.id, notification_id)
    if not updated:
        raise HTTPException(status_code=404, detail="notification not found")
    return updated


@router.post("/read-all")
def mark_all_notifications_read(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[NotificationRepository, Depends(get_notification_repository)],
) -> dict[str, str]:
    repository.mark_all_read(current_user.id)
    return {"status": "ok"}
