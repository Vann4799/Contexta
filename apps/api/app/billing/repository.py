from typing import Protocol

from app.billing.models import (
    BillingStatus,
    Plan,
    PlanLimits,
    PlanTier,
    Subscription,
    UsageSummary,
)


PLANS: dict[PlanTier, Plan] = {
    "free": Plan(
        tier="free",
        name="Free",
        price_monthly=0,
        price_yearly=0,
        limits=PlanLimits(
            max_documents=10,
            max_storage_bytes=100 * 1024 * 1024,
            max_api_keys=2,
            max_api_requests_per_day=100,
            max_chat_messages_per_day=50,
        ),
    ),
    "pro": Plan(
        # Flip to True once a Stripe webhook writes `subscriptions` and the limits below
        # are enforced in the service — until then checkout takes money for nothing.
        tier="pro",
        name="Pro",
        price_monthly=29,
        price_yearly=290,
        sellable=False,
        limits=PlanLimits(
            max_documents=500,
            max_storage_bytes=10 * 1024 * 1024 * 1024,
            max_api_keys=10,
            max_api_requests_per_day=10000,
            max_chat_messages_per_day=1000,
        ),
    ),
    "enterprise": Plan(
        # Not sellable either: 100 GB of files and a ~5M-chunk index do not fit the
        # single VPS everything else shares.
        tier="enterprise",
        name="Enterprise",
        price_monthly=99,
        price_yearly=990,
        sellable=False,
        limits=PlanLimits(
            max_documents=10000,
            max_storage_bytes=100 * 1024 * 1024 * 1024,
            max_api_keys=100,
            max_api_requests_per_day=100000,
            max_chat_messages_per_day=10000,
        ),
    ),
}


class BillingRepository(Protocol):
    def get_subscription(self, user_id: str) -> Subscription | None:
        ...

    def get_usage(self, user_id: str) -> UsageSummary:
        ...


class InMemoryBillingRepository:
    def __init__(self) -> None:
        self._subscriptions: dict[str, Subscription] = {}
        self._usage: dict[str, UsageSummary] = {}

    def get_subscription(self, user_id: str) -> Subscription | None:
        return self._subscriptions.get(user_id)

    def get_usage(self, user_id: str) -> UsageSummary:
        return self._usage.get(
            user_id,
            UsageSummary(
                documents_count=0,
                storage_bytes=0,
                api_keys_count=0,
                api_requests_today=0,
                chat_messages_today=0,
            ),
        )


class SupabaseBillingRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
        }

    def get_subscription(self, user_id: str) -> Subscription | None:
        import httpx

        response = httpx.get(
            f"{self._supabase_url}/rest/v1/subscriptions",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
        )
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return None
        return Subscription.model_validate(rows[0])

    def get_usage(self, user_id: str) -> UsageSummary:
        import httpx

        response = httpx.post(
            f"{self._supabase_url}/rest/v1/rpc/billing_usage",
            headers={**self._headers, "Content-Type": "application/json"},
            json={"p_user_id": user_id},
        )
        response.raise_for_status()
        return UsageSummary.model_validate(response.json())


billing_repository = InMemoryBillingRepository()


def get_billing_status(
    user_id: str,
    repository: BillingRepository,
) -> BillingStatus:
    subscription = repository.get_subscription(user_id)
    plan_tier: PlanTier = subscription.plan_tier if subscription else "free"
    plan = PLANS[plan_tier]
    usage = repository.get_usage(user_id)

    overages = {
        "documents": usage.documents_count > plan.limits.max_documents,
        "storage": usage.storage_bytes > plan.limits.max_storage_bytes,
        "api_keys": usage.api_keys_count > plan.limits.max_api_keys,
        "api_requests": usage.api_requests_today > plan.limits.max_api_requests_per_day,
        "chat_messages": usage.chat_messages_today > plan.limits.max_chat_messages_per_day,
    }

    return BillingStatus(
        subscription=subscription,
        plan=plan,
        usage=usage,
        overages=overages,
    )
