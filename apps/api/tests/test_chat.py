from __future__ import annotations

from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.models import RetrievedContext
from app.chat.repository import InMemoryChatRepository
from app.chat.routes import get_answer_generator, get_chat_repository, get_retriever
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

    def generate_answer(self, prompt: str) -> str:
        self.prompt = prompt
        return "Contexta is a grounded document chatbot. [Source 1]"


def override_user() -> CurrentUser:
    return CurrentUser(id="user-chat-123", email="user@example.com", role="authenticated")


def test_chat_query_returns_answer_with_citations() -> None:
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
                "chunk_index": 0,
                "page_number": 2,
                "text": "Contexta answers questions using uploaded documents.",
                "score": 0.91,
            }
        ],
    }
    assert retriever.received_user_id == "user-chat-123"
    assert retriever.received_question == "What is Contexta?"
    assert "Document: overview.pdf" in answer_generator.prompt
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
