"""The measured cost ledger: what a call reported, what it cost, and what a user sees.

Every test here pins the two rules the feature exists to enforce: a token count only ever
comes from the provider's own `usage` block, and a cost only ever comes from a configured
price - anything else stays null and says so.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat import routes as chat_routes
from app.chat.llm import DeepSeekAnswerGenerator, DeepSeekQueryRewriter
from app.chat.models import RetrievedContext
from app.chat.routes import build_answer_generator, get_retriever
from app.core.config import Settings
from app.documents import routes as documents_routes
from app.main import app
from app.services.llm_budget import brief_day_budget, llm_day_budget
from app.usage import dependencies as usage_dependencies
from app.usage import repository as usage_repository
from app.usage.models import LlmCallRow, TokenUsage, cost_for_call, parse_llm_usage
from app.usage.repository import (
    InMemoryLlmCallRepository,
    SupabaseLlmCallRepository,
)
from app.usage.routes import get_llm_call_repository


USER_ID = "11111111-1111-4111-8111-111111111111"
OTHER_ID = "22222222-2222-4222-8222-222222222222"
DOCUMENT_ID = "33333333-3333-4333-8333-333333333333"
PRICED_MODEL = "deepseek-v4-pro"
# The rewrite model ships with no price on purpose; these tests depend on that.
UNPRICED_MODEL = "deepseek-chat"


@pytest.fixture(autouse=True)
def isolate_app() -> None:
    llm_day_budget.reset()
    brief_day_budget.reset()
    usage_repository.llm_call_repository.rows.clear()
    app.dependency_overrides.clear()
    yield
    llm_day_budget.reset()
    brief_day_budget.reset()
    usage_repository.llm_call_repository.rows.clear()
    app.dependency_overrides.clear()


def _settings(**overrides: object) -> Settings:
    base: dict[str, object] = {
        "environment": "test",
        "deepseek_api_key": "test-key",
        "deepseek_model": PRICED_MODEL,
        "llm_day_limit": 0,
        "brief_day_limit": 0,
    }
    base.update(overrides)
    return Settings(**base)


def _user() -> CurrentUser:
    return CurrentUser(id=USER_ID, email="user@example.com", role="authenticated")


def _context() -> RetrievedContext:
    return {
        "document_id": DOCUMENT_ID,
        "document_name": "overview.pdf",
        "doc_type": "report",
        "chunk_index": 0,
        "page_number": 2,
        "section_path": "2. Architecture",
        "text": "Contexta answers from uploaded documents.",
        "score": 0.9,
        "fusion_score": 0.0164,
    }


class FakeRetriever:
    def retrieve(
        self,
        user_id: str,
        question: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[RetrievedContext]:
        return [_context()]


class RecordingRepository:
    """Stands in for the ledger so a test can read exactly what would have been stored."""

    def __init__(self) -> None:
        self.rows: list[LlmCallRow] = []

    def record_call(self, row: LlmCallRow) -> None:
        self.rows.append(row)

    def summary(self, user_id: str, days: int) -> dict[str, object]:
        return {
            "days": days,
            "totals": {
                "calls": 1,
                "calls_without_tokens": 0,
                "calls_unpriced": 0,
                "prompt_tokens": 10,
                "completion_tokens": 2,
                "reasoning_tokens": 0,
                "cost_usd": 0.001,
            },
            "by_purpose": [],
            "by_day": [],
        }


class ExplodingRepository(RecordingRepository):
    def record_call(self, row: LlmCallRow) -> None:
        raise httpx.ConnectError("rest unavailable: secret upstream body")


class FailingSummaryRepository(RecordingRepository):
    def summary(self, user_id: str, days: int) -> dict[str, object]:
        raise httpx.HTTPStatusError(
            "Server error '500' for url 'https://supabase.example/rest/v1/rpc/llm_usage_summary'",
            request=httpx.Request("POST", "https://supabase.example"),
            response=httpx.Response(500, text='{"message":"relation does not exist"}'),
        )


def _completion(
    content: str = "Jawaban berakar. [Source 1]",
    finish_reason: str = "stop",
    usage: dict[str, object] | None = None,
) -> dict[str, object]:
    body: dict[str, object] = {
        "choices": [{"message": {"content": content}, "finish_reason": finish_reason}]
    }
    if usage is not None:
        body["usage"] = usage
    return body


def _measured(prompt: int = 1_000, completion: int = 200, reasoning: int = 0) -> dict[str, object]:
    """The block DeepSeek actually returns, shape verified on a live call."""
    details: dict[str, object] = {"reasoning_tokens": reasoning} if reasoning else {}
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": prompt + completion,
        "prompt_tokens_details": {"cached_tokens": 0},
        "completion_tokens_details": details,
    }


def _client(
    repository: RecordingRepository,
    responses: list[dict[str, object]],
    **settings_overrides: object,
) -> TestClient:
    """A /chat/query client wired to a mock provider and one recording ledger."""
    attempts: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(request)
        return httpx.Response(200, json=responses[len(attempts) - 1])

    settings = _settings(**settings_overrides)
    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever()
    app.dependency_overrides[build_answer_generator] = lambda: DeepSeekAnswerGenerator(
        api_key="test-key",
        model=PRICED_MODEL,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    app.dependency_overrides[get_llm_call_repository] = lambda: repository
    # One override for the whole app: chat_routes and documents_routes import the same
    # get_settings object, so the ledger prices on the Settings the client was built with -
    # which is what makes a price change testable at all.
    app.dependency_overrides[chat_routes.get_settings] = lambda: settings
    client = TestClient(app)
    client.requests = attempts  # type: ignore[attr-defined]
    return client


# --- what the provider reported -------------------------------------------------------------


def test_a_deepseek_usage_block_is_read_from_the_response() -> None:
    """Measured live: DeepSeek returns prompt/completion/total tokens on every call."""
    usage = parse_llm_usage(
        {"choices": [{"message": {"content": "x"}}], "usage": _measured(91, 11, 8)},
        model=PRICED_MODEL,
    )

    assert usage == TokenUsage(
        model=PRICED_MODEL,
        prompt_tokens=91,
        completion_tokens=11,
        reasoning_tokens=8,
        provider_cost_usd=None,
    )


def test_a_gateway_price_is_kept_separate_from_a_derived_one() -> None:
    """OpenRouter settles some calls with `usage.cost`; DeepSeek never sends this key."""
    usage = parse_llm_usage(
        {"usage": {"prompt_tokens": 5, "completion_tokens": 2, "cost": 0.000123}},
        model="openrouter/model",
    )

    assert usage.provider_cost_usd == pytest.approx(0.000123)


def test_a_response_without_usage_records_nothing_rather_than_a_guess() -> None:
    usage = parse_llm_usage({"choices": [{"message": {"content": "x"}}]}, model=PRICED_MODEL)

    assert usage == TokenUsage(model=PRICED_MODEL)
    assert usage.prompt_tokens is None
    assert usage.completion_tokens is None


def test_a_thinking_model_without_reasoning_detail_stays_silent_about_it() -> None:
    """deepseek-chat sends no reasoning_tokens key; that is not a claim of zero thought."""
    usage = parse_llm_usage({"usage": {"prompt_tokens": 9, "completion_tokens": 3}}, model=UNPRICED_MODEL)

    assert usage.reasoning_tokens is None
    assert usage.prompt_tokens == 9


def test_a_usage_field_that_is_not_a_count_is_dropped() -> None:
    """A gateway that answers `true` or -1 for tokens told us nothing; 0 would be a lie."""
    usage = parse_llm_usage(
        {"usage": {"prompt_tokens": True, "completion_tokens": -5}}, model=PRICED_MODEL
    )

    assert usage.prompt_tokens is None
    assert usage.completion_tokens is None


# --- what it cost ---------------------------------------------------------------------------


def test_a_priced_model_bills_both_halves_of_the_pair() -> None:
    settings = _settings(
        llm_price_input_per_million={"deepseek-v4-pro": 1.0},
        llm_price_output_per_million={"deepseek-v4-pro": 2.0},
    )

    cost, basis = cost_for_call(
        TokenUsage(model=PRICED_MODEL, prompt_tokens=1_000, completion_tokens=500), settings
    )

    assert cost == pytest.approx((1_000 * 1.0 + 500 * 2.0) / 1_000_000)
    assert basis == "prices"


def test_a_model_with_no_configured_price_has_no_cost() -> None:
    """The gate this whole table exists for: null, never a neighbour's price."""
    cost, basis = cost_for_call(
        TokenUsage(model=UNPRICED_MODEL, prompt_tokens=5_000, completion_tokens=900), _settings()
    )

    assert cost is None
    assert basis is None


def test_half_a_price_pair_is_not_a_price() -> None:
    """An input rate with no output rate would bill every completion as free."""
    settings = _settings(
        llm_price_input_per_million={PRICED_MODEL: 0.66},
        llm_price_output_per_million={},
    )

    assert cost_for_call(TokenUsage(model=PRICED_MODEL, prompt_tokens=10, completion_tokens=5), settings) == (
        None,
        None,
    )


def test_a_missing_token_count_never_becomes_a_zero_dollar_call() -> None:
    settings = _settings(
        llm_price_input_per_million={PRICED_MODEL: 0.66},
        llm_price_output_per_million={PRICED_MODEL: 1.98},
    )

    assert cost_for_call(TokenUsage(model=PRICED_MODEL, prompt_tokens=10), settings) == (None, None)


def test_a_gateway_price_wins_over_the_configured_one() -> None:
    cost, basis = cost_for_call(
        TokenUsage(model=PRICED_MODEL, prompt_tokens=1_000, completion_tokens=1_000, provider_cost_usd=0.02),
        _settings(
            llm_price_input_per_million={PRICED_MODEL: 0.66},
            llm_price_output_per_million={PRICED_MODEL: 1.98},
        ),
    )

    assert (cost, basis) == (0.02, "provider")


def test_reasoning_tokens_are_not_billed_twice() -> None:
    """DeepSeek counts reasoning inside completion_tokens (measured: 11, of which 8 reasoned)."""
    settings = _settings(
        llm_price_input_per_million={PRICED_MODEL: 0.66},
        llm_price_output_per_million={PRICED_MODEL: 1.98},
    )
    without = TokenUsage(model=PRICED_MODEL, prompt_tokens=1_000, completion_tokens=200)
    with_reasoning = TokenUsage(
        model=PRICED_MODEL, prompt_tokens=1_000, completion_tokens=200, reasoning_tokens=150
    )

    assert cost_for_call(without, settings)[0] == cost_for_call(with_reasoning, settings)[0]


def test_the_shipped_default_price_pair_is_the_off_peak_figure() -> None:
    """A quoted number, not a provider statement: the report calls it a floor."""
    settings = Settings()

    assert cost_for_call(
        TokenUsage(model=PRICED_MODEL, prompt_tokens=1_000_000, completion_tokens=1_000_000),
        settings,
    )[0] == pytest.approx(0.66 + 1.98)


# --- the row that reaches PostgREST ---------------------------------------------------------


def test_the_row_written_is_exactly_the_ledger_columns(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: dict[str, object] = {}

    def fake_post(url: str, headers: dict[str, str], json: dict[str, object], **_: object) -> httpx.Response:
        sent["url"] = url
        sent["headers"] = headers
        sent["json"] = json
        # raise_for_status() needs the request stamped on the response, which httpx does for a
        # real round trip and a fake has to imitate.
        return httpx.Response(201, request=httpx.Request("POST", url))

    monkeypatch.setattr(usage_repository.httpx, "post", fake_post)
    repository = SupabaseLlmCallRepository("https://supabase.example/", "service-key")

    repository.record_call(
        LlmCallRow(
            user_id=USER_ID,
            purpose="chat",
            model=PRICED_MODEL,
            prompt_tokens=None,
            completion_tokens=None,
            reasoning_tokens=None,
            cost_usd=None,
            cost_basis=None,
        )
    )

    assert sent["url"] == "https://supabase.example/rest/v1/llm_calls"
    assert sent["json"] == {
        "user_id": USER_ID,
        "purpose": "chat",
        "model": PRICED_MODEL,
        "prompt_tokens": None,
        "completion_tokens": None,
        "reasoning_tokens": None,
        "cost_usd": None,
        "cost_basis": None,
    }
    headers = sent["headers"]  # type: ignore[assignment]
    assert headers["apikey"] == "service-key"
    assert headers["Authorization"] == "Bearer service-key"
    # The row id is never read back, so making PostgREST serialize it is pure hot-path cost.
    assert headers["Prefer"] == "return=minimal"


def test_the_summary_read_is_one_rpc_call(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: dict[str, object] = {}

    def fake_post(url: str, headers: dict[str, str], json: dict[str, object], **_: object) -> httpx.Response:
        sent["url"] = url
        sent["headers"] = headers
        sent["json"] = json
        return httpx.Response(
            200,
            json={"days": 14, "totals": {}, "by_purpose": [], "by_day": []},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(usage_repository.httpx, "post", fake_post)
    repository = SupabaseLlmCallRepository("https://supabase.example", "service-key")

    body = repository.summary(USER_ID, 14)

    assert sent["url"] == "https://supabase.example/rest/v1/rpc/llm_usage_summary"
    assert sent["json"] == {"p_user_id": USER_ID, "p_days": 14}
    assert body["days"] == 14
    assert sent["headers"]["Authorization"] == "Bearer service-key"  # type: ignore[index]
    # An RPC read has no insert whose representation could be minimised; sending Prefer here
    # would be a habit copied onto the wrong call.
    assert "Prefer" not in sent["headers"]  # type: ignore[operator]


# --- when a call happens --------------------------------------------------------------------


def test_one_row_per_measured_chat_call() -> None:
    repository = RecordingRepository()
    client = _client(
        repository,
        [_completion(usage=_measured(1_000, 200))],
        llm_price_input_per_million={PRICED_MODEL: 0.66},
        llm_price_output_per_million={PRICED_MODEL: 1.98},
    )

    assert client.post("/chat/query", json={"question": "Apa?"}).status_code == 200

    assert len(repository.rows) == 1
    row = repository.rows[0]
    assert (row.user_id, row.purpose, row.model) == (USER_ID, "chat", PRICED_MODEL)
    assert (row.prompt_tokens, row.completion_tokens) == (1_000, 200)
    assert row.cost_usd == pytest.approx((1_000 * 0.66 + 200 * 1.98) / 1_000_000)
    assert row.cost_basis == "prices"


def test_the_retry_that_made_a_second_call_is_a_second_row() -> None:
    """A truncation retry is a wider, separately billed completion, not a repeat of the first.

    The row count is per HTTP attempt by design; recording one row per click would understate
    exactly the case the estimate used to miss.
    """
    repository = RecordingRepository()
    client = _client(
        repository,
        [
            _completion(content="", finish_reason="length", usage=_measured(1_000, 900, 900)),
            _completion(usage=_measured(1_000, 200)),
        ],
    )

    assert client.post("/chat/query", json={"question": "Apa?"}).status_code == 200

    assert len(client.requests) == 2  # type: ignore[attr-defined]
    assert len(repository.rows) == 2
    assert repository.rows[0].completion_tokens == 900
    assert repository.rows[1].completion_tokens == 200


def test_a_call_with_no_usage_block_is_still_ledgered_with_nulls() -> None:
    repository = RecordingRepository()
    client = _client(repository, [_completion()])

    assert client.post("/chat/query", json={"question": "Apa?"}).status_code == 200

    row = repository.rows[0]
    assert row.prompt_tokens is None
    assert row.cost_usd is None
    assert row.cost_basis is None


def test_a_ledger_outage_never_costs_the_user_their_answer(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The insert is best effort: a bad answer is a lost row, and nothing else."""
    client = _client(ExplodingRepository(), [_completion(usage=_measured())])
    caplog.set_level(logging.ERROR, logger="app.services.llm_usage")

    with caplog.at_level(logging.ERROR):
        response = client.post("/chat/query", json={"question": "Apa?"})

    assert response.status_code == 200
    assert response.json()["answer"].startswith("Jawaban berakar")
    assert "rest unavailable" not in response.text
    assert any("could not ledger" in record.getMessage() for record in caplog.records)


# --- which surface bills which purpose ------------------------------------------------------


def test_each_purpose_labels_the_rows_its_dependency_builds() -> None:
    settings = _settings()
    user = _user()
    repository = RecordingRepository()

    chat_inner = DeepSeekAnswerGenerator(api_key="k", model=PRICED_MODEL)
    chat_routes.get_answer_generator(settings, user, chat_inner, repository)  # type: ignore[arg-type]
    brief_inner = DeepSeekAnswerGenerator(api_key="k", model=PRICED_MODEL)
    documents_routes.get_document_answer_generator(settings, user, brief_inner, repository)  # type: ignore[arg-type]
    rewrite_inner = DeepSeekQueryRewriter(api_key="k", model=UNPRICED_MODEL)
    chat_routes.get_query_rewriter(settings, user, rewrite_inner, repository)  # type: ignore[arg-type]

    sinks = [
        getattr(client, "_on_usage")
        for client in (chat_inner, brief_inner, rewrite_inner)
    ]
    assert all(callable(sink) for sink in sinks)

    sinks[0](TokenUsage(model=PRICED_MODEL, prompt_tokens=1, completion_tokens=1))
    sinks[1](TokenUsage(model=PRICED_MODEL, prompt_tokens=1, completion_tokens=1))
    sinks[2](TokenUsage(model=UNPRICED_MODEL, prompt_tokens=1, completion_tokens=1))

    assert [row.purpose for row in repository.rows] == ["chat", "brief", "rewrite"]
    assert repository.rows[2].model == UNPRICED_MODEL
    assert repository.rows[2].cost_usd is None


def test_a_kill_switched_rewriter_is_not_ledgered() -> None:
    """No inner client means no call, and a row for a call nobody made would be a lie."""
    repository = RecordingRepository()

    assert chat_routes.get_query_rewriter(_settings(), _user(), None, repository) is None  # type: ignore[arg-type]
    assert repository.rows == []


def test_the_eval_harness_stays_out_of_the_ledger() -> None:
    """build_* constructs an unmetered client; only the route layer binds a user to a row."""
    inner = DeepSeekAnswerGenerator(api_key="k", model=PRICED_MODEL)

    assert getattr(inner, "_on_usage", None) is None


# --- what the user sees ---------------------------------------------------------------------


def test_the_endpoint_reports_this_user_s_totals() -> None:
    repository = InMemoryLlmCallRepository()
    now = datetime(2026, 10, 14, 9, 30, tzinfo=timezone.utc)
    repository.rows = [
        {
            "user_id": USER_ID,
            "purpose": "chat",
            "model": PRICED_MODEL,
            "prompt_tokens": 1_000,
            "completion_tokens": 200,
            "reasoning_tokens": 50,
            "cost_usd": 0.001,
            "cost_basis": "prices",
            "created_at": now,
        },
        {
            "user_id": USER_ID,
            "purpose": "brief",
            "model": UNPRICED_MODEL,
            "prompt_tokens": None,
            "completion_tokens": None,
            "reasoning_tokens": None,
            "cost_usd": None,
            "cost_basis": None,
            "created_at": now - timedelta(days=1),
        },
        {
            "user_id": OTHER_ID,
            "purpose": "chat",
            "model": PRICED_MODEL,
            "prompt_tokens": 8_000,
            "completion_tokens": 8_000,
            "reasoning_tokens": None,
            "cost_usd": 99.0,
            "cost_basis": "prices",
            "created_at": now,
        },
        {
            "user_id": USER_ID,
            "purpose": "chat",
            "model": PRICED_MODEL,
            "prompt_tokens": 4_000,
            "completion_tokens": 100,
            "reasoning_tokens": None,
            "cost_usd": 0.003,
            "cost_basis": "prices",
            "created_at": now - timedelta(days=40),
        },
    ]
    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_llm_call_repository] = lambda: repository

    with TestClient(app) as client:
        body = client.get("/usage/llm?days=3").json()

    assert body["days"] == 3
    assert body["totals"] == {
        "calls": 2,
        "calls_without_tokens": 1,
        "calls_unpriced": 1,
        "prompt_tokens": 1_000,
        "completion_tokens": 200,
        "reasoning_tokens": 50,
        "cost_usd": 0.001,
    }
    # One call each, so the name tie-break decides: the same order on every page load.
    assert [entry["purpose"] for entry in body["by_purpose"]] == ["brief", "chat"]
    assert [day["date"] for day in body["by_day"]] == [
        "2026-10-12",
        "2026-10-13",
        "2026-10-14",
    ]
    assert body["by_day"][0] == {
        "date": "2026-10-12",
        "calls": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "cost_usd": None,
    }
    assert [entry["date"] for entry in body["by_day"] if entry["calls"]] == [
        "2026-10-13",
        "2026-10-14",
    ]


def test_the_window_asked_for_is_the_only_scoping_argument() -> None:
    """The id comes from the JWT; no request field can point this at another workspace."""
    seen: list[tuple[str, int]] = []

    class Spy(InMemoryLlmCallRepository):
        def summary(self, user_id: str, days: int) -> dict[str, object]:
            seen.append((user_id, days))
            return super().summary(user_id, days)

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_llm_call_repository] = lambda: Spy()

    with TestClient(app) as client:
        client.get(f"/usage/llm?days=14&user_id={OTHER_ID}")

    assert seen == [(USER_ID, 14)]


def test_the_default_window_is_the_one_the_rpc_agrees_on() -> None:
    seen: list[int] = []

    class Spy(InMemoryLlmCallRepository):
        def summary(self, user_id: str, days: int) -> dict[str, object]:
            seen.append(days)
            return super().summary(user_id, days)

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_llm_call_repository] = lambda: Spy()

    with TestClient(app) as client:
        assert client.get("/usage/llm").json()["days"] == 30

    assert seen == [30]


def test_a_window_past_retention_is_refused_before_it_is_read() -> None:
    """Asking for 91 days would report pruned history as a month the model stopped answering."""
    app.dependency_overrides[get_current_user] = _user

    with TestClient(app) as client:
        assert client.get("/usage/llm?days=91").status_code == 422
        assert client.get("/usage/llm?days=0").status_code == 422


def test_the_endpoint_is_not_anonymous() -> None:
    with TestClient(app) as client:
        assert client.get("/usage/llm").status_code == 401


def test_a_store_outage_is_a_503_that_hides_the_providers_text() -> None:
    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_llm_call_repository] = lambda: FailingSummaryRepository()

    with TestClient(app) as client:
        response = client.get("/usage/llm")

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "llm_usage_store_unavailable"
    assert "relation does not exist" not in response.text


def test_an_aggregate_that_does_not_match_the_model_is_not_repaired() -> None:
    """A half-populated cost report is worse than an honest retry, so a shape drift is a 503."""

    class Drifted(InMemoryLlmCallRepository):
        def summary(self, user_id: str, days: int) -> dict[str, object]:
            return {"days": days}

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_llm_call_repository] = lambda: Drifted()

    with TestClient(app) as client:
        assert client.get("/usage/llm").json()["detail"]["code"] == "llm_usage_malformed"


# --- the mirror the route is tested against -------------------------------------------------


def test_an_unpriced_stretch_reads_as_unknown_not_as_free() -> None:
    repository = InMemoryLlmCallRepository()
    repository.record_call(
        LlmCallRow(USER_ID, "chat", UNPRICED_MODEL, 10, 5, None, None, None)
    )

    totals = repository.summary(USER_ID, 30)["totals"]

    assert totals["cost_usd"] is None
    assert totals["calls_unpriced"] == 1
    assert totals["calls_without_tokens"] == 0


def test_the_day_series_names_every_day_in_the_window() -> None:
    repository = InMemoryLlmCallRepository(
        clock=lambda: datetime(2026, 10, 14, 23, 0, tzinfo=timezone.utc)
    )

    days = repository.summary(USER_ID, 5)["by_day"]

    assert [day["date"] for day in days] == [
        "2026-10-10",
        "2026-10-11",
        "2026-10-12",
        "2026-10-13",
        "2026-10-14",
    ]


def test_the_purpose_ordering_survives_a_refresh() -> None:
    repository = InMemoryLlmCallRepository()
    for _ in range(2):
        repository.record_call(LlmCallRow(USER_ID, "brief", PRICED_MODEL, 1, 1, None, 0.1, "prices"))
    repository.record_call(LlmCallRow(USER_ID, "chat", PRICED_MODEL, 1, 1, None, 0.2, "prices"))

    by_purpose = repository.summary(USER_ID, 30)["by_purpose"]

    assert [entry["purpose"] for entry in by_purpose] == ["brief", "chat"]


def test_pruning_keeps_the_window_and_drops_what_the_worker_would() -> None:
    clock = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)
    repository = InMemoryLlmCallRepository(clock=lambda: clock)
    repository.record_call(LlmCallRow(USER_ID, "chat", PRICED_MODEL, 1, 1, None, 0.1, "prices"))
    repository.rows[0]["created_at"] = clock - timedelta(days=91)
    repository.record_call(LlmCallRow(USER_ID, "chat", PRICED_MODEL, 1, 1, None, 0.1, "prices"))
    repository.rows[-1]["created_at"] = clock - timedelta(days=2)

    assert repository.prune_calls(90) == 1
    assert repository.summary(USER_ID, 90)["totals"]["calls"] == 1


def test_the_default_repository_is_swappable_per_test() -> None:
    """get_llm_call_repository reads the module attribute, so that is the seam a test replaces."""
    fresh = InMemoryLlmCallRepository()
    monkey = pytest.MonkeyPatch()
    monkey.setattr(usage_dependencies, "llm_call_repository", fresh)

    assert usage_dependencies.get_llm_call_repository(_settings()) is fresh
    assert usage_dependencies.get_llm_call_repository(
        _settings(supabase_url="https://supabase.example", supabase_service_role_key="k")
    ) is not fresh
    monkey.undo()
