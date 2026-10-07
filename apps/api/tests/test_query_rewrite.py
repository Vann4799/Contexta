from __future__ import annotations

from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.models import ChatMessageResponse, ChatSessionResponse, RetrievedContext
from app.chat.repository import InMemoryChatRepository
from app.chat.rewrite import accept_rewrite, conversation_history, needs_rewrite
from app.chat.routes import (
    get_answer_generator,
    get_chat_repository,
    get_document_repository,
    get_query_rewriter,
    get_retriever,
)
from app.core.config import Settings
from app.documents.repository import InMemoryDocumentRepository
from app.main import app

client = TestClient(app)

CONTEXT: RetrievedContext = {
    "document_id": "doc-1",
    "document_name": "laporan.pdf",
    "doc_type": "report",
    "chunk_index": 3,
    "page_number": 11,
    "section_path": "BAB V > Testing",
    "text": "Black box testing dijalankan pada seluruh fitur.",
    "score": 0.62,
}


def message(role: str, content: str) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=f"msg-{role}-{len(content)}",
        session_id="session-1",
        user_id="user-1",
        role=role,
        content=content,
        citations=[],
        metadata={},
        created_at="2026-10-07T00:00:00+00:00",
    )


def test_history_keeps_only_usable_turns_and_drops_the_rest():
    history = conversation_history(
        [
            message("user", "Apa metode pengujian yang dipakai?"),
            message("system", "ignored"),
            message("assistant", "   "),
            message("assistant", "Black Box Testing."),
        ]
    )

    assert history == [
        {"role": "user", "content": "Apa metode pengujian yang dipakai?"},
        {"role": "assistant", "content": "Black Box Testing."},
    ]


def test_gate_waits_for_an_answer_before_spending_a_call():
    assert needs_rewrite("terus hasilnya gimana?", []) == (False, "no_history")
    assert needs_rewrite(
        "terus hasilnya gimana?", [{"role": "user", "content": "apa metodenya?"}]
    ) == (False, "no_history")


def test_gate_takes_short_and_reference_bearing_follow_ups():
    history = [
        {"role": "user", "content": "Apa metode pengujian yang dipakai?"},
        {"role": "assistant", "content": "Black Box Testing untuk seluruh fitur."},
    ]

    assert needs_rewrite("terus hasilnya gimana?", history) == (True, "followup")
    # Measured on the live harness: nine words but the referent is "di situ".
    assert needs_rewrite(
        "elemen apa di situ yang bisa naikkan motivasi intrinsik?", history
    ) == (True, "followup")
    assert needs_rewrite("Apa keunggulan metode itu untuk aplikasi mobile?", history) == (
        True,
        "followup",
    )


def test_gate_leaves_a_long_self_contained_question_alone():
    history = [{"role": "assistant", "content": "Black Box Testing."}]
    question = (
        "Jelaskan secara lengkap bagaimana proses pengumpulan data penelitian dilakukan "
        "pada tahap awal sebelum implementasi sistem dimulai dan siapa saja yang terlibat"
    )

    assert needs_rewrite(question, history) == (False, "standalone")


def test_accept_rewrite_rejects_everything_unusable():
    question = "terus hasilnya gimana?"

    assert accept_rewrite(None, question) == (question, "failed")
    assert accept_rewrite("   \n  ", question) == (question, "failed")
    assert accept_rewrite("Terus hasilnya gimana?", question) == (question, "unchanged")
    assert accept_rewrite("x" * 400, question) == (question, "too_long")


def test_accept_rewrite_keeps_the_first_real_line():
    query, reason = accept_rewrite(
        "\nBagaimana hasil pengujian black box pada aplikasi?\n(context from chat)",
        "terus hasilnya gimana?",
    )

    assert reason == "applied"
    assert query == "Bagaimana hasil pengujian black box pada aplikasi?"


class FakeRetriever:
    def __init__(self) -> None:
        self.received_question = ""

    def retrieve(
        self,
        user_id: str,
        question: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[RetrievedContext]:
        self.received_question = question
        return [CONTEXT]


class FakeAnswerGenerator:
    def __init__(self) -> None:
        self.prompt = ""

    def generate_answer(self, prompt: str) -> str:
        self.prompt = prompt
        return "Hasilnya semua fitur lolos. [Source 1]"


class FakeRewriter:
    def __init__(self, result: str | None = None, raises: bool = False) -> None:
        self.result = result
        self.raises = raises
        self.calls = 0

    def rewrite_query(self, question: str, history) -> str | None:
        self.calls += 1
        if self.raises:
            raise RuntimeError("DeepSeek rewrite error 503")
        return self.result


def override_user() -> CurrentUser:
    return CurrentUser(id="user-chat-123", email="user@example.com", role="authenticated")


def seeded_session(exchange: bool = True) -> tuple[ChatSessionResponse, InMemoryChatRepository]:
    repository = InMemoryChatRepository()
    session = repository.create_session("user-chat-123", title="New chat")
    if exchange:
        repository.create_message(
            "user-chat-123", session.id, "user", "Apa metode pengujian yang dipakai?"
        )
        repository.create_message("user-chat-123", session.id, "assistant", "Black Box Testing.")
    return session, repository


def test_follow_up_is_searched_with_the_rewritten_query() -> None:
    session, chat_repository = seeded_session()
    retriever = FakeRetriever()
    generator = FakeAnswerGenerator()
    rewriter = FakeRewriter(result="Bagaimana hasil black box testing pada aplikasi?")
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: chat_repository
    app.dependency_overrides[get_document_repository] = lambda: InMemoryDocumentRepository()
    app.dependency_overrides[get_retriever] = lambda: retriever
    app.dependency_overrides[get_answer_generator] = lambda: generator
    app.dependency_overrides[get_query_rewriter] = lambda: rewriter

    response = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={"question": "terus hasilnya gimana?"},
    )

    assert response.status_code == 200
    assert retriever.received_question == "Bagaimana hasil black box testing pada aplikasi?"
    # The answer still sees the wording the user typed, plus the turns needed to resolve it.
    assert "terus hasilnya gimana?" in generator.prompt
    assert "User: Apa metode pengujian yang dipakai?" in generator.prompt
    stored = chat_repository.list_messages("user-chat-123", session.id)[-1]
    assert stored.metadata == {
        "retrieval_query": "Bagaimana hasil black box testing pada aplikasi?",
        "rewrite": "applied",
    }
    app.dependency_overrides.clear()


def test_first_question_never_spends_a_rewrite_call() -> None:
    session, chat_repository = seeded_session(exchange=False)
    rewriter = FakeRewriter(result="should not be used")
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: chat_repository
    app.dependency_overrides[get_document_repository] = lambda: InMemoryDocumentRepository()
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever()
    app.dependency_overrides[get_answer_generator] = lambda: FakeAnswerGenerator()
    app.dependency_overrides[get_query_rewriter] = lambda: rewriter

    client.post(
        f"/chat/sessions/{session.id}/messages",
        json={"question": "Apa metode pengujian yang dipakai?"},
    )

    assert rewriter.calls == 0
    stored = chat_repository.list_messages("user-chat-123", session.id)[-1]
    assert stored.metadata["rewrite"] == "no_history"
    app.dependency_overrides.clear()


def test_a_broken_rewrite_still_answers_with_the_raw_question() -> None:
    session, chat_repository = seeded_session()
    retriever = FakeRetriever()
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: chat_repository
    app.dependency_overrides[get_document_repository] = lambda: InMemoryDocumentRepository()
    app.dependency_overrides[get_retriever] = lambda: retriever
    app.dependency_overrides[get_answer_generator] = lambda: FakeAnswerGenerator()
    app.dependency_overrides[get_query_rewriter] = lambda: FakeRewriter(raises=True)

    response = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={"question": "terus hasilnya gimana?"},
    )

    assert response.status_code == 200
    assert retriever.received_question == "terus hasilnya gimana?"
    stored = chat_repository.list_messages("user-chat-123", session.id)[-1]
    assert stored.metadata["rewrite"] == "failed"
    app.dependency_overrides.clear()


def test_rewriter_is_disabled_without_a_key_or_without_a_model() -> None:
    assert get_query_rewriter(Settings(deepseek_api_key="", deepseek_rewrite_model="deepseek-chat")) is None
    assert get_query_rewriter(Settings(deepseek_api_key="k", deepseek_rewrite_model="")) is None
    assert get_query_rewriter(Settings(deepseek_api_key="k", deepseek_rewrite_model="deepseek-chat")) is not None
