from datetime import datetime
from typing import Literal

from pydantic import BaseModel


PlanTier = Literal["free", "pro", "enterprise"]
BillingInterval = Literal["monthly", "yearly"]


class PlanLimits(BaseModel):
    max_documents: int
    max_storage_bytes: int
    max_api_keys: int
    max_api_requests_per_day: int
    max_chat_messages_per_day: int


class Plan(BaseModel):
    tier: PlanTier
    name: str
    price_monthly: int
    price_yearly: int
    limits: PlanLimits
    sellable: bool = True


class Subscription(BaseModel):
    id: str
    user_id: str
    plan_tier: PlanTier
    status: Literal["active", "cancelled", "past_due", "trialing"]
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    created_at: datetime


class UsageSummary(BaseModel):
    documents_count: int
    storage_bytes: int
    api_keys_count: int
    api_requests_today: int
    chat_messages_today: int


class BillingStatus(BaseModel):
    subscription: Subscription | None
    plan: Plan
    usage: UsageSummary
    overages: dict[str, bool]


class CheckoutRequest(BaseModel):
    plan_tier: PlanTier
    interval: BillingInterval = "monthly"


class CheckoutResponse(BaseModel):
    checkout_url: str
