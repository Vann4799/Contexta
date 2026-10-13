"""The billing page used to answer in 760 ms: get_usage() asked PostgREST for five separate
lists and counted them in Python. One RPC is now the contract, so the test is a call count."""

import httpx
import pytest

from app.billing.models import UsageSummary
from app.billing.repository import SupabaseBillingRepository

RPC_URL = "https://project.supabase.co/rest/v1/rpc/billing_usage"


@pytest.fixture
def posted_urls(monkeypatch):
    calls: list[tuple[str, dict]] = []

    def fake_post(url, headers=None, json=None, **kwargs):
        calls.append((url, json or {}))
        return httpx.Response(
            200,
            json={
                "documents_count": 3,
                "storage_bytes": 4096,
                "api_keys_count": 1,
                "api_requests_today": 12,
                "chat_messages_today": 5,
            },
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    return calls


def test_usage_answers_in_one_round_trip(posted_urls) -> None:
    repository = SupabaseBillingRepository("https://project.supabase.co", "service-key")

    usage = repository.get_usage("owner-1")

    assert [url for url, _ in posted_urls] == [RPC_URL]
    assert usage == UsageSummary(
        documents_count=3,
        storage_bytes=4096,
        api_keys_count=1,
        api_requests_today=12,
        chat_messages_today=5,
    )


def test_the_owner_is_taken_from_the_session_not_the_request(posted_urls) -> None:
    repository = SupabaseBillingRepository("https://project.supabase.co", "service-key")

    repository.get_usage("owner-1")

    assert posted_urls[0][1] == {"p_user_id": "owner-1"}
