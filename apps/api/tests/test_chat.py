from __future__ import annotations

from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.llm import AnswerResult
from app.chat.models import ChatQueryResponse, RetrievedContext
from app.chat.repository import InMemoryChatRepository
from app.chat.routes import (
    build_exact_count_response,
    build_highest_metric_response,
    count_target_pattern,
    get_answer_generator,
    get_chat_repository,
    get_document_repository,
    get_retriever,
)
from app.documents.models import DocumentResponse
from app.documents.repository import InMemoryDocumentRepository
from app.main import app


client = TestClient(app)


class FakeRetriever:
    def __init__(self, contexts: list[RetrievedContext]) -> None:
        self.contexts = contexts
        self.received_user_id = ""
        self.received_question = ""

    def retrieve(
        self,
        user_id: str,
        question: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[RetrievedContext]:
        self.received_user_id = user_id
        self.received_question = question
        return self.contexts


class FakeAnswerGenerator:
    def __init__(self) -> None:
        self.prompt = ""

    def generate_answer(self, prompt: str) -> AnswerResult:
        self.prompt = prompt
        return AnswerResult("Contexta is a grounded document chatbot. [Source 1]")


def override_user() -> CurrentUser:
    return CurrentUser(id="user-chat-123", email="user@example.com", role="authenticated")


def test_chat_query_returns_answer_with_citations() -> None:
    retriever = FakeRetriever(
        [
            {
                "document_id": "doc-1",
                "document_name": "overview.pdf",
                "doc_type": "report",
                "chunk_index": 0,
                "page_number": 2,
                "section_path": "2. Architecture",
                "text": "Contexta answers questions using uploaded documents.",
                "score": 0.91,
            }
        ]
    )
    answer_generator = FakeAnswerGenerator()
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_retriever] = lambda: retriever
    app.dependency_overrides[get_answer_generator] = lambda: answer_generator

    response = client.post(
        "/chat/query",
        json={"question": "What is Contexta?"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "answer": "Contexta is a grounded document chatbot. [Source 1]",
        "citations": [
            {
                "source_number": 1,
                "document_id": "doc-1",
                "document_name": "overview.pdf",
                "doc_type": "report",
                "chunk_index": 0,
                "page_number": 2,
                "section_path": "2. Architecture",
                "text": "Contexta answers questions using uploaded documents.",
                "score": 0.91,
            }
        ],
        "truncated": False,
    }
    assert retriever.received_user_id == "user-chat-123"
    assert retriever.received_question == "What is Contexta?"
    assert "Document: overview.pdf" in answer_generator.prompt
    assert "Section: 2. Architecture" in answer_generator.prompt
    app.dependency_overrides.clear()


def test_chat_query_returns_insufficient_context_when_no_chunks_match() -> None:
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever([])
    app.dependency_overrides[get_answer_generator] = lambda: FakeAnswerGenerator()

    response = client.post(
        "/chat/query",
        json={"question": "What is the budget?"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "answer": "The document context is insufficient to answer that question.",
        "citations": [],
        "truncated": False,
    }
    app.dependency_overrides.clear()


def test_create_chat_session_then_list_sessions() -> None:
    repository = InMemoryChatRepository()
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: repository

    create_response = client.post(
        "/chat/sessions",
        json={"title": "Creator Track questions"},
    )

    assert create_response.status_code == 201
    created_session = create_response.json()
    assert created_session["user_id"] == "user-chat-123"
    assert created_session["title"] == "Creator Track questions"

    list_response = client.get("/chat/sessions")

    assert list_response.status_code == 200
    assert list_response.json() == [created_session]
    app.dependency_overrides.clear()


def test_session_message_stores_user_and_assistant_messages() -> None:
    repository = InMemoryChatRepository()
    retriever = FakeRetriever(
        [
            {
                "document_id": "doc-1",
                "document_name": "overview.pdf",
                "chunk_index": 0,
                "page_number": 2,
                "text": "Contexta answers questions using uploaded documents.",
                "score": 0.91,
            }
        ]
    )
    answer_generator = FakeAnswerGenerator()
    session = repository.create_session("user-chat-123", title="New chat")
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: repository
    app.dependency_overrides[get_retriever] = lambda: retriever
    app.dependency_overrides[get_answer_generator] = lambda: answer_generator

    response = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={"question": "What is Contexta?"},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "Contexta is a grounded document chatbot. [Source 1]"

    messages_response = client.get(f"/chat/sessions/{session.id}/messages")

    assert messages_response.status_code == 200
    messages = messages_response.json()
    assert [message["role"] for message in messages] == ["user", "assistant"]
    assert messages[0]["content"] == "What is Contexta?"
    assert messages[1]["content"] == "Contexta is a grounded document chatbot. [Source 1]"
    assert messages[1]["citations"][0]["document_name"] == "overview.pdf"
    app.dependency_overrides.clear()


class TruncatedAnswerGenerator:
    """Mirrors DeepSeek hitting max_tokens mid-marker: `[Source 2` without the close."""

    def generate_answer(self, prompt: str) -> AnswerResult:
        return AnswerResult(
            "Rows 3 and 9 match the filter. [Source 1] [Source 2",
            truncated=True,
        )


def test_truncated_query_answer_is_flagged_and_marker_repaired() -> None:
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever(contexts_with_one_chunk())
    app.dependency_overrides[get_answer_generator] = TruncatedAnswerGenerator

    response = client.post("/chat/query", json={"question": "Which rows match?"})

    assert response.status_code == 200
    body = response.json()
    assert body["truncated"] is True
    assert body["answer"] == "Rows 3 and 9 match the filter. [Source 1]"
    app.dependency_overrides.clear()


def test_truncated_session_answer_is_persisted_with_the_flag() -> None:
    repository = InMemoryChatRepository()
    session = repository.create_session("user-chat-123", title="New chat")
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: repository
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever(contexts_with_one_chunk())
    app.dependency_overrides[get_answer_generator] = TruncatedAnswerGenerator

    response = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={"question": "Which rows match?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["truncated"] is True
    assert body["answer"] == "Rows 3 and 9 match the filter. [Source 1]"

    messages = client.get(f"/chat/sessions/{session.id}/messages").json()
    assert messages[1]["content"] == "Rows 3 and 9 match the filter. [Source 1]"
    assert messages[1]["metadata"]["truncated"] is True
    app.dependency_overrides.clear()


def test_session_message_counts_target_across_all_document_chunks_without_llm() -> None:
    chat_repository = InMemoryChatRepository()
    document_repository = InMemoryDocumentRepository()
    document = DocumentResponse(
        id="doc-1",
        user_id="user-chat-123",
        filename="creator-track.pdf",
        file_type="pdf",
        file_size=100,
        storage_path="user-chat-123/doc-1/creator-track.pdf",
        status="ready",
        error_message=None,
        chunk_count=2,
        created_at="2026-06-06T00:00:00+00:00",
        updated_at="2026-06-06T00:00:00+00:00",
    )
    document_repository._documents.append(document)
    document_repository.add_chunks(
        [
            {
                "document_id": "doc-1",
                "user_id": "user-chat-123",
                "chunk_index": 0,
                "text": (
                    "4/20/2026 10:29:31 user@example.com 0x9vann link a "
                    "Short post X 5 26 0 0 "
                    "4/20/2026 10:30:28 user@example.com 0x9vann link b "
                    "Short post X 5 21 0 0"
                ),
                "page_number": 1,
                "qdrant_point_id": "point-1",
            },
            {
                "document_id": "doc-1",
                "user_id": "user-chat-123",
                "chunk_index": 1,
                "text": (
                    "4/20/2026 10:31:21 user@example.com 0x9vann link c "
                    "Short post X 5 22 0 0 "
                    "4/20/2026 10:33:13 user@example.com someoneelse link d "
                    "Short post X 5 14 0 0"
                ),
                "page_number": 2,
                "qdrant_point_id": "point-2",
            },
        ]
    )
    answer_generator = FakeAnswerGenerator()
    session = chat_repository.create_session("user-chat-123", title="New chat")
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: chat_repository
    app.dependency_overrides[get_document_repository] = lambda: document_repository
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever([])
    app.dependency_overrides[get_answer_generator] = lambda: answer_generator

    response = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={
            "question": "cek ada berapa total postingan yang di punyai oleh user dengan nama 0x9vann",
            "document_ids": ["doc-1"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "3 postingan/baris" in body["answer"]
    assert body["citations"][0]["document_name"] == "creator-track.pdf"
    assert answer_generator.prompt == ""
    app.dependency_overrides.clear()


def test_session_message_counts_table_rows_not_duplicate_name_occurrences() -> None:
    chat_repository = InMemoryChatRepository()
    document_repository = InMemoryDocumentRepository()
    document = DocumentResponse(
        id="doc-1",
        user_id="user-chat-123",
        filename="creator-track.pdf",
        file_type="pdf",
        file_size=100,
        storage_path="user-chat-123/doc-1/creator-track.pdf",
        status="ready",
        error_message=None,
        chunk_count=1,
        created_at="2026-06-06T00:00:00+00:00",
        updated_at="2026-06-06T00:00:00+00:00",
    )
    document_repository._documents.append(document)
    document_repository.add_chunks(
        [
            {
                "document_id": "doc-1",
                "user_id": "user-chat-123",
                "chunk_index": 0,
                "text": (
                    "4/20/2026 10:29:31 cicachacha23@gmail.com chacha "
                    "https://x.com/haicharicacha/status/1 Short post X 5 26 0 0 "
                    "4/20/2026 10:30:28 cicachacha23@gmail.com chacha "
                    "https://x.com/haicharicacha/status/2 Short post X 5 21 0 0"
                ),
                "page_number": 1,
                "qdrant_point_id": "point-1",
            },
        ]
    )
    answer_generator = FakeAnswerGenerator()
    session = chat_repository.create_session("user-chat-123", title="New chat")
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: chat_repository
    app.dependency_overrides[get_document_repository] = lambda: document_repository
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever([])
    app.dependency_overrides[get_answer_generator] = lambda: answer_generator

    response = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={
            "question": "cek ada berapa total postingan yang di punyai oleh user dengan nama chacha",
            "document_ids": ["doc-1"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "2 postingan/baris" in body["answer"]
    assert "email atau link" in body["answer"]
    assert answer_generator.prompt == ""
    app.dependency_overrides.clear()


def test_session_message_answers_highest_metric_from_table_rows_without_llm() -> None:
    chat_repository = InMemoryChatRepository()
    document_repository = InMemoryDocumentRepository()
    document = DocumentResponse(
        id="doc-1",
        user_id="user-chat-123",
        filename="creator-track.pdf",
        file_type="pdf",
        file_size=100,
        storage_path="user-chat-123/doc-1/creator-track.pdf",
        status="ready",
        error_message=None,
        chunk_count=1,
        created_at="2026-06-06T00:00:00+00:00",
        updated_at="2026-06-06T00:00:00+00:00",
    )
    document_repository._documents.append(document)
    document_repository.add_chunks(
        [
            {
                "document_id": "doc-1",
                "user_id": "user-chat-123",
                "chunk_index": 0,
                "text": (
                    "4/20/2026 10:29:31 first@example.com Alpha 1111111111 "
                    "https://x.com/a Short post (Text + Image) X (Twitter) 5 26 0 0 "
                    "4/20/2026 10:30:28 second@example.com Beta 2222222222 "
                    "https://x.com/b Long Post (Text + Image) X (Twitter) 5 410 12 3"
                ),
                "page_number": 1,
                "qdrant_point_id": "point-1",
            },
        ]
    )
    answer_generator = FakeAnswerGenerator()
    session = chat_repository.create_session("user-chat-123", title="New chat")
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: chat_repository
    app.dependency_overrides[get_document_repository] = lambda: document_repository
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever([])
    app.dependency_overrides[get_answer_generator] = lambda: answer_generator

    response = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={
            "question": "Siapa creator dengan view paling tinggi?",
            "document_ids": ["doc-1"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "410" in body["answer"]
    assert "Beta" in body["answer"]
    assert body["citations"][0]["text"].startswith("4/20/2026 10:30:28")
    assert answer_generator.prompt == ""
    app.dependency_overrides.clear()


def test_first_session_message_updates_new_chat_title() -> None:
    repository = InMemoryChatRepository()
    session = repository.create_session("user-chat-123", title="New chat")
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: repository
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever([])
    app.dependency_overrides[get_answer_generator] = lambda: FakeAnswerGenerator()

    response = client.post(
        f"/chat/sessions/{session.id}/messages",
        json={"question": "Ringkas isi dokumen creator track dalam 5 poin."},
    )

    assert response.status_code == 200
    sessions_response = client.get("/chat/sessions")
    assert sessions_response.status_code == 200
    assert sessions_response.json()[0]["title"] == "Ringkas isi dokumen creator track dalam 5 poin."
    app.dependency_overrides.clear()


class FailingAnswerGenerator:
    """Mirrors a DeepSeek HTTP failure: the raw text names the upstream host."""

    def generate_answer(self, prompt: str) -> str:
        raise RuntimeError(
            "Client error '400 Bad Request' for url 'https://api.deepseek.com/v1/chat/completions'"
        )


def contexts_with_one_chunk() -> list[RetrievedContext]:
    return [
        {
            "document_id": "doc-1",
            "document_name": "overview.pdf",
            "doc_type": "report",
            "chunk_index": 0,
            "page_number": 2,
            "section_path": "2. Architecture",
            "text": "Contexta answers questions using uploaded documents.",
            "score": 0.91,
        }
    ]


def test_chat_query_hides_the_answer_model_failure_text() -> None:
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever(contexts_with_one_chunk())
    app.dependency_overrides[get_answer_generator] = FailingAnswerGenerator

    response = client.post("/chat/query", json={"question": "What is Contexta?"})

    assert response.status_code == 502
    assert response.json()["detail"] == "Unable to answer question."
    assert "deepseek" not in response.text.lower()
    app.dependency_overrides.clear()


def test_session_message_hides_the_answer_model_failure_text() -> None:
    repository = InMemoryChatRepository()
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: repository
    app.dependency_overrides[get_document_repository] = InMemoryDocumentRepository
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever(contexts_with_one_chunk())
    app.dependency_overrides[get_answer_generator] = FailingAnswerGenerator

    session = client.post("/chat/sessions", json={"title": "qa"})
    response = client.post(
        f"/chat/sessions/{session.json()['id']}/messages",
        json={"question": "What is Contexta?"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Unable to answer question."
    assert "deepseek" not in response.text.lower()
    app.dependency_overrides.clear()


class FailingRetriever:
    """Mirrors Qdrant 404ing a missing collection or an embedding arm raising."""

    def retrieve(self, **kwargs: object) -> list[RetrievedContext]:
        raise RuntimeError(
            "Not Found for url "
            "'https://qdrant.example.internal/collections/contexta_chunks/points/search'"
        )


def test_chat_query_turns_a_retrieval_outage_into_502() -> None:
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_retriever] = lambda: FailingRetriever()
    app.dependency_overrides[get_answer_generator] = FakeAnswerGenerator

    response = client.post("/chat/query", json={"question": "What is Contexta?"})

    assert response.status_code == 502
    assert response.json()["detail"] == "Unable to answer question."
    assert "qdrant" not in response.text.lower()
    app.dependency_overrides.clear()


def test_failed_answer_does_not_leave_an_orphan_question_in_history() -> None:
    """A retry would otherwise store the same turn twice, and the rewrite gate reads it."""
    repository = InMemoryChatRepository()
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_chat_repository] = lambda: repository
    app.dependency_overrides[get_document_repository] = InMemoryDocumentRepository
    app.dependency_overrides[get_answer_generator] = FakeAnswerGenerator

    session_id = client.post("/chat/sessions", json={"title": "qa"}).json()["id"]

    app.dependency_overrides[get_retriever] = lambda: FailingRetriever()
    first = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"question": "What is Contexta?"},
    )
    assert first.status_code == 502
    assert repository.list_messages("user-chat-123", session_id) == []

    app.dependency_overrides[get_retriever] = lambda: FakeRetriever(
        contexts_with_one_chunk()
    )
    second = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"question": "What is Contexta?"},
    )

    assert second.status_code == 200
    stored = repository.list_messages("user-chat-123", session_id)
    assert [message.role for message in stored] == ["user", "assistant"]
    app.dependency_overrides.clear()


COUNT_QUESTION = (
    "cek ada berapa total postingan yang di punyai oleh user dengan nama chacha"
)
HIGHEST_VIEW_QUESTION = "Siapa creator dengan view paling tinggi?"


def table_row(*, timestamp: str, email: str, name: str, link: str, view: int) -> str:
    return (
        f"{timestamp} {email} {name} 1111111111 {link} "
        f"Short post X (Twitter) 5 {view} 0 0"
    )


def table_repository(chunk_texts: list[str]) -> InMemoryDocumentRepository:
    repository = InMemoryDocumentRepository()
    repository._documents.append(
        DocumentResponse(
            id="doc-1",
            user_id="user-chat-123",
            filename="creator-track.pdf",
            file_type="pdf",
            file_size=100,
            storage_path="user-chat-123/doc-1/creator-track.pdf",
            status="ready",
            error_message=None,
            chunk_count=len(chunk_texts),
            created_at="2026-06-06T00:00:00+00:00",
            updated_at="2026-06-06T00:00:00+00:00",
        )
    )
    repository.add_chunks(
        [
            {
                "document_id": "doc-1",
                "user_id": "user-chat-123",
                "chunk_index": index,
                "text": text,
                "page_number": 1,
                "qdrant_point_id": f"point-{index}",
            }
            for index, text in enumerate(chunk_texts)
        ]
    )
    return repository


def count_response(repository: InMemoryDocumentRepository) -> ChatQueryResponse:
    answer = build_exact_count_response(
        COUNT_QUESTION,
        "user-chat-123",
        ["doc-1"],
        repository,
    )
    assert answer is not None
    return answer


def test_exact_count_matches_whole_names_only() -> None:
    """A bare substring made "chacha" claim the rows of "chachary" and of the address "cicachacha23@…"."""
    repository = table_repository(
        [
            " ".join(
                [
                    table_row(
                        timestamp="4/20/2026 10:29:31",
                        email="first@example.com",
                        name="chacha",
                        link="https://x.com/c/1",
                        view=26,
                    ),
                    table_row(
                        timestamp="4/20/2026 10:30:31",
                        email="chachary@example.com",
                        name="chachary",
                        link="https://x.com/r/1",
                        view=9,
                    ),
                    table_row(
                        timestamp="4/20/2026 10:31:31",
                        email="cicachacha23@gmail.com",
                        name="Chacha",
                        link="https://x.com/c/2",
                        view=11,
                    ),
                ]
            )
        ]
    )

    response = count_response(repository)

    assert "2 postingan/baris" in response.answer
    assert all("chachary" not in citation.text for citation in response.citations)


def test_overlapping_chunks_count_one_posting_once() -> None:
    first = table_row(
        timestamp="4/20/2026 10:29:31",
        email="first@example.com",
        name="chacha",
        link="https://x.com/c/1",
        view=26,
    )
    second = table_row(
        timestamp="4/20/2026 10:30:31",
        email="first@example.com",
        name="chacha",
        link="https://x.com/c/2",
        view=9,
    )
    third = table_row(
        timestamp="4/20/2026 10:31:31",
        email="first@example.com",
        name="chacha",
        link="https://x.com/c/3",
        view=11,
    )
    repository = table_repository([f"{first} {second}", f"{second} {third}"])

    response = count_response(repository)

    assert "3 postingan/baris" in response.answer


def test_prose_mentions_are_not_added_to_table_rows() -> None:
    row = table_row(
        timestamp="4/20/2026 10:29:31",
        email="first@example.com",
        name="chacha",
        link="https://x.com/c/1",
        view=26,
    )
    repository = table_repository(
        [row, "chacha wrote the summary, then chacha forwarded it"]
    )

    response = count_response(repository)

    assert "1 postingan/baris" in response.answer
    assert "kemunculan" not in response.answer


def test_prose_only_document_falls_back_to_occurrences() -> None:
    repository = table_repository(["chacha wrote the summary, then chacha forwarded it"])

    response = count_response(repository)

    assert "2 kemunculan teks" in response.answer


def test_count_target_pattern_handles_prefixed_names() -> None:
    pattern = count_target_pattern("chacha")
    assert pattern.search("4/20/2026 10:29:31 a@b.com chacha 1111111111")
    assert not pattern.search("chachary")
    assert not pattern.search("cicachacha23@gmail.com")

    handle = count_target_pattern("@chacha")
    assert handle.search("posted by @chacha on X")
    assert not handle.search("@chachary")


def test_highest_metric_declines_when_no_row_parses() -> None:
    """Rows the metrics regex cannot read are a decline, not a crash or a wrong winner."""
    repository = table_repository(
        ["4/20/2026 10:29:31 first@example.com chacha a post with no id or metrics"]
    )

    answer = build_highest_metric_response(
        HIGHEST_VIEW_QUESTION,
        "user-chat-123",
        ["doc-1"],
        repository,
    )

    assert answer is not None
    assert "belum bisa menghitung" in answer.answer
    assert answer.citations == []
