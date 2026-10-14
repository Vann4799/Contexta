from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings
from app.billing.models import BillingStatus, CheckoutRequest, CheckoutResponse, Plan
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


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(
    body: CheckoutRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CheckoutResponse:
    plan = PLANS.get(body.plan_tier)
    if not plan or body.plan_tier == "free":
        raise HTTPException(status_code=400, detail="Cannot checkout free plan")

    if not plan.sellable:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "plan_not_available",
                "message": f"{plan.name} is not open for signup yet. Contexta is in beta.",
            },
        )

    import stripe

    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    price_cents = (
        plan.price_yearly * 100 if body.interval == "yearly" else plan.price_monthly * 100
    )
    recurring = {"interval": "year" if body.interval == "yearly" else "month"}

    stripe.api_key = settings.stripe_secret_key
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=current_user.email,
        client_reference_id=current_user.id,
        success_url=f"{settings.app_base_url}/billing?success=true",
        cancel_url=f"{settings.app_base_url}/billing?canceled=true",
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": price_cents,
                    "recurring": recurring,
                    "product_data": {"name": plan.name},
                },
                "quantity": 1,
            }
        ],
    )
    return CheckoutResponse(checkout_url=session.url)
