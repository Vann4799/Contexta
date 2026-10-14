"""Beta: only Free is deliverable, so checkout must refuse before Stripe is touched.

A UI label is not a gate — this is the call that can actually charge somebody.
"""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.billing.models import CheckoutRequest
from app.billing.repository import PLANS
from app.billing.routes import create_checkout_session

USER = SimpleNamespace(id="owner-1", email="owner@example.test")
SETTINGS = SimpleNamespace(stripe_secret_key="sk_test_not_a_real_key", app_base_url="https://app.test")


@pytest.mark.parametrize("tier", ["pro", "enterprise"])
def test_unsellable_plans_never_reach_stripe(tier: str) -> None:
    assert PLANS[tier].sellable is False

    with pytest.raises(HTTPException) as raised:
        create_checkout_session(
            CheckoutRequest(plan_tier=tier, interval="monthly"),
            current_user=USER,  # type: ignore[arg-type]
            settings=SETTINGS,  # type: ignore[arg-type]
        )

    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "plan_not_available"


def test_free_is_still_rejected_as_before() -> None:
    with pytest.raises(HTTPException) as raised:
        create_checkout_session(
            CheckoutRequest(plan_tier="free", interval="monthly"),
            current_user=USER,  # type: ignore[arg-type]
            settings=SETTINGS,  # type: ignore[arg-type]
        )

    assert raised.value.status_code == 400
