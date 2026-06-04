from __future__ import annotations

from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.models import RetrievedContext
from app.chat.routes import get_answer_generator, get_retriever
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
