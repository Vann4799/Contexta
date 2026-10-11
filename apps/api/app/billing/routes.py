from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings
from app.billing.models import BillingStatus, Plan
from app.billing.repository import (
    BillingRepository,
    SupabaseBillingRepository,
    billing_repository,
    PLANS,
    get_billing_status,
)


router = APIRouter(prefix="/billing", tags=["billing"])


def get_billing_repo(
    settings: Annotated[Settings, Depends(get_settings)],
) -> BillingRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseBillingRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return billing_repository


@router.get("/plans", response_model=list[Plan])
def list_plans() -> list[Plan]:
    return list(PLANS.values())


@router.get("/status", response_model=BillingStatus)
def get_billing_status_endpoint(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[BillingRepository, Depends(get_billing_repo)],
) -> BillingStatus:
    return get_billing_status(current_user.id, repository)
