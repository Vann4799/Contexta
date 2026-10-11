from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings
from app.activity.models import ActivityFeedResponse
from app.activity.repository import (
    ActivityRepository,
    SupabaseActivityRepository,
    activity_repository,
    DEFAULT_ACTIVITY_LIMIT,
    MAX_ACTIVITY_LIMIT,
)


router = APIRouter(prefix="/activity", tags=["activity"])


def get_activity_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ActivityRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseActivityRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return activity_repository


@router.get("", response_model=ActivityFeedResponse)
def list_activity_events(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ActivityRepository, Depends(get_activity_repository)],
    limit: Annotated[int, Query(ge=1, le=MAX_ACTIVITY_LIMIT)] = DEFAULT_ACTIVITY_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ActivityFeedResponse:
    events, total = repository.list_events(current_user.id, limit, offset)
    return ActivityFeedResponse(
        events=events,
        total=total,
        has_more=offset + limit < total,
    )
