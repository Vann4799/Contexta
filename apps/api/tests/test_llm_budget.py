from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.models import RetrievedContext
from app.chat.repository import InMemoryChatRepository
from app.chat.routes import (
    build_answer_generator,
    get_chat_repository,
    get_document_repository,
    get_query_rewriter,
    get_retriever,
)
from app.core.config import Settings, get_settings
from app.documents.models import DocumentCreate
from app.documents.repository import InMemoryDocumentRepository
from app.documents.routes import (
    build_document_answer_generator,
    get_document_repository as get_brief_document_repository,
)
from app.main import app
from app.services.llm_budget import (
    BudgetedAnswerGenerator,
    BudgetedQueryRewriter,
    LlmDayBudget,
    llm_day_budget,
)


client = TestClient(app)

USER_ID = "user-llm-budget"
DOCUMENT_ID = "22222222-2222-4222-8222-222222222222"


class CountingGenerator:
    def __init__(self) -> None:
        self.calls = 0

    def generate_answer(self, prompt: str) -> str:
        self.calls += 1
        return "Grounded answer. [Source 1]"


class CountingRewriter:
    def __init__(self) -> None:
        self.calls = 0

    def rewrite_query(self, question: str, history: list) -> str | None:
        self.calls += 1
        return f"rewritten {question}"


class FakeRetriever:
    def __init__(self, contexts: list[RetrievedContext]) -> None:
        self.contexts = contexts

    def retrieve(
        self,
        user_id: str,
        question: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[RetrievedContext]:
        return self.contexts


def user() -> CurrentUser:
    return CurrentUser(id=USER_ID, email="user@example.com", role="authenticated")


def context() -> RetrievedContext:
    return {
        "document_id": DOCUMENT_ID,
        "document_name": "overview.pdf",
        "doc_type": "report",
        "chunk_index": 0,
        "page_number": 2,
        "section_path": "2. Architecture",
        "text": "Contexta answers from uploaded documents.",
        "score": 0.9,
    }


@pytest.fixture(autouse=True)
def isolate_app() -> None:
    """The shared budget is process state; a suite must not inherit yesterday's count."""
    llm_day_budget.reset()
    yield
    llm_day_budget.reset()
    app.dependency_overrides.clear()


def override_chat(generator: CountingGenerator, contexts: list[RetrievedContext], limit: int) -> None:
    app.dependency_overrides[get_current_user] = user
    app.dependency_overrides[get_settings] = lambda: Settings(
        llm_day_limit=limit, environment="test"
    )
    app.dependency_overrides[build_answer_generator] = lambda: generator
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever(contexts)


def test_the_allowance_refuses_the_next_model_call_once_spent() -> None:
    budget = LlmDayBudget()

    budget.charge(USER_ID, limit=2)
    budget.charge(USER_ID, limit=2)

    with pytest.raises(HTTPException) as refused:
        budget.charge(USER_ID, limit=2)

    assert refused.value.status_code == 429
    assert refused.value.detail["code"] == "llm_day_limit_exceeded"
    assert 1 <= int(refused.value.headers["Retry-After"]) <= 86_400
    assert budget.used_today(USER_ID) == 2


def test_the_day_window_moves_with_utc() -> None:
    """A process must not freeze its window to the day it happened to start on."""
    budget = LlmDayBudget()

    budget.charge(USER_ID, limit=1, day="2026-10-08")

    assert budget.used_today(USER_ID, day="2026-10-08") == 1
    assert budget.used_today(USER_ID, day="2026-10-09") == 0
    budget.charge(USER_ID, limit=1, day="2026-10-09")


def test_a_zero_limit_never_counts_and_never_refuses() -> None:
    budget = LlmDayBudget()

    for _ in range(5):
        budget.charge(USER_ID, limit=0)

    assert budget.used_today(USER_ID) == 0
    assert budget.allows(USER_ID, limit=0) is True


def test_counters_from_an_older_day_are_dropped_as_the_store_grows() -> None:
    budget = LlmDayBudget(tracked_limit=2)

    budget.charge("user-yesterday", limit=5, day="2026-10-07")
    budget.charge("user-today-a", limit=5, day="2026-10-08")
    budget.charge("user-today-b", limit=5, day="2026-10-08")

    assert budget.used_today("user-today-a", day="2026-10-08") == 1
    assert budget.used_today("user-yesterday", day="2026-10-08") == 0


def test_a_generator_that_is_never_called_never_spends_the_allowance() -> None:
    budget = LlmDayBudget()
    inner = CountingGenerator()
    wrapped = BudgetedAnswerGenerator(inner, budget, USER_ID, limit=1)

    assert wrapped.generate_answer("prompt") == "Grounded answer. [Source 1]"
    assert budget.used_today(USER_ID) == 1

    with pytest.raises(HTTPException):
        wrapped.generate_answer("prompt")
    assert inner.calls == 1


def test_a_spent_allowance_declines_the_rewrite_instead_of_raising() -> None:
    """resolve_retrieval_query swallows every rewrite exception, so a raising wrapper
    would report a failure for a call the budget refused to make."""
    budget = LlmDayBudget()
    budget.charge(USER_ID, limit=1)
    inner = CountingRewriter()
    wrapped = BudgetedQueryRewriter(inner, budget, USER_ID, limit=1)

    assert wrapped.rewrite_query("terus hasilnya?", []) is None
    assert inner.calls == 0
    assert budget.used_today(USER_ID) == 1


def test_a_rewrite_within_the_allowance_costs_one_unit() -> None:
    budget = LlmDayBudget()
    inner = CountingRewriter()
    wrapped = BudgetedQueryRewriter(inner, budget, USER_ID, limit=2)

    assert wrapped.rewrite_query("terus hasilnya?", []) == "rewritten terus hasilnya?"
    assert budget.used_today(USER_ID) == 1


def test_chat_query_is_answered_until_the_daily_allowance_is_gone() -> None:
    generator = CountingGenerator()
    override_chat(generator, [context()], limit=2)

    first = client.post("/chat/query", json={"question": "What is Contexta?"})
    second = client.post("/chat/query", json={"question": "And then?"})
    third = client.post("/chat/query", json={"question": "Again?"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"]["code"] == "llm_day_limit_exceeded"
    assert generator.calls == 2


def test_a_question_answered_without_the_model_does_not_spend_the_allowance() -> None:
    generator = CountingGenerator()
    override_chat(generator, [], limit=1)

    response = client.post("/chat/query", json={"question": "What is Contexta?"})

    assert response.status_code == 200
    assert "insufficient" in response.json()["answer"]
    assert generator.calls == 0
    assert llm_day_budget.used_today(USER_ID) == 0


def test_the_allowance_is_per_user() -> None:
    generator = CountingGenerator()
    override_chat(generator, [context()], limit=1)

    first_user = client.post("/chat/query", json={"question": "What is Contexta?"})
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="other-user", email="other@example.com", role="authenticated"
    )
    second_user = client.post("/chat/query", json={"question": "What is Contexta?"})

    assert first_user.status_code == 200
    assert second_user.status_code == 200
    assert generator.calls == 2


def test_a_session_message_is_refused_once_the_allowance_is_spent() -> None:
    chat_repository = InMemoryChatRepository()
    generator = CountingGenerator()
    app.dependency_overrides[get_chat_repository] = lambda: chat_repository
    app.dependency_overrides[get_document_repository] = lambda: InMemoryDocumentRepository()
    app.dependency_overrides[get_query_rewriter] = lambda: None
    override_chat(generator, [context()], limit=1)
    session = chat_repository.create_session(USER_ID, "Riset")

    first = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={"question": "What is Contexta?"},
    )
    second = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={"question": "And then?"},
    )

    assert first.status_code == 200
    assert second.status_code == 429
    assert [
        message.role for message in chat_repository.list_messages(USER_ID, session.id)
    ] == ["user", "assistant"]


def test_a_brief_is_refused_once_the_allowance_is_spent() -> None:
    documents = InMemoryDocumentRepository()
    document = documents.create_document(
        USER_ID,
        DocumentCreate(
            filename="creator.pdf",
            file_type="pdf",
            file_size=1200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/creator.pdf",
        ),
    )
    documents.add_chunks(
        [
            {
                "document_id": document.id,
                "user_id": USER_ID,
                "chunk_index": 0,
                "text": "Creator responses are dominated by X/Twitter content.",
                "page_number": 1,
                "qdrant_point_id": "point-0",
            }
        ]
    )
    generator = CountingGenerator()
    app.dependency_overrides[get_current_user] = user
    app.dependency_overrides[get_settings] = lambda: Settings(
        llm_day_limit=1, environment="test"
    )
    app.dependency_overrides[build_document_answer_generator] = lambda: generator
    app.dependency_overrides[get_brief_document_repository] = lambda: documents

    first = client.post(f"/documents/{document.id}/brief")
    second = client.post(f"/documents/{document.id}/brief")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["detail"]["code"] == "llm_day_limit_exceeded"
    assert generator.calls == 1
