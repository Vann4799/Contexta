from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app.documents import routes as document_routes
from app.chat.llm import DeepSeekAnswerGenerator
from app.documents.models import DocumentCreate, DocumentResponse
from app.documents.repository import InMemoryDocumentRepository
from app.main import app
from app.documents.routes import (
    get_document_answer_generator,
    get_document_repository,
    get_document_storage,
    get_document_vector_cleanup,
)
from app.documents.storage import InMemoryDocumentStorage, SupabaseDocumentStorage
from app.documents.vector_cleanup import NoopDocumentVectorCleanup
from app.core.config import Settings, get_settings


USER_ID = "user-documents-123"
DOCUMENT_ID = "11111111-1111-4111-8111-111111111111"

client = TestClient(app)


class FakeAnswerGenerator:
    def __init__(self) -> None:
        self.prompt = ""

    def generate_answer(self, prompt: str) -> str:
        self.prompt = prompt
        return "AI brief: creator responses are dominated by X/Twitter content."


def test_document_answer_generator_uses_configured_token_limit() -> None:
    generator = get_document_answer_generator(
        Settings(
            deepseek_api_key="test-key",
            deepseek_model="deepseek-v4-pro",
            deepseek_max_tokens=2222,
        )
    )

    assert isinstance(generator, DeepSeekAnswerGenerator)
    assert generator._max_tokens == 2222


@pytest.fixture(autouse=True)
def document_repository_override() -> None:
    repository = InMemoryDocumentRepository()
    storage = InMemoryDocumentStorage()
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_document_storage] = lambda: storage
    app.dependency_overrides[get_document_vector_cleanup] = lambda: NoopDocumentVectorCleanup()
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_jwt_secret="test-secret",
        supabase_jwks_url="",
        supabase_url="",
        supabase_service_role_key="",
    )
    yield
    app.dependency_overrides.clear()


def auth_headers(user_id: str = USER_ID) -> dict[str, str]:
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": user_id,
            "email": "user@example.com",
            "role": "authenticated",
            "aud": "authenticated",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
        },
        "test-secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def test_list_documents_without_auth_returns_401() -> None:
    response = client.get("/documents")

    assert response.status_code == 401


def test_create_document_metadata_then_list_documents() -> None:
    payload = {
        "filename": "policy.pdf",
        "file_type": "pdf",
        "file_size": 1200,
        "storage_path": f"{USER_ID}/{DOCUMENT_ID}/policy.pdf",
    }

    create_response = client.post(
        "/documents",
        json=payload,
        headers=auth_headers(),
    )

    assert create_response.status_code == 201
    created_document = create_response.json()
    assert created_document == {
        "id": created_document["id"],
        "user_id": USER_ID,
        "filename": "policy.pdf",
        "file_type": "pdf",
        "file_size": 1200,
        "storage_path": f"{USER_ID}/{DOCUMENT_ID}/policy.pdf",
        "status": "processing",
        "error_message": None,
        "chunk_count": 0,
        "created_at": created_document["created_at"],
        "updated_at": created_document["updated_at"],
    }

    list_response = client.get("/documents", headers=auth_headers())

    assert list_response.status_code == 200
    assert list_response.json() == [created_document]


def test_get_document_returns_only_owned_document() -> None:
    repository = InMemoryDocumentRepository()
    app.dependency_overrides[get_document_repository] = lambda: repository
    created = repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="policy.pdf",
            file_type="pdf",
            file_size=1200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/policy.pdf",
        ),
    )

    owned_response = client.get(f"/documents/{created.id}", headers=auth_headers())
    other_user_response = client.get(
        f"/documents/{created.id}",
        headers=auth_headers("other-user"),
    )

    assert owned_response.status_code == 200
    assert owned_response.json()["id"] == created.id
    assert other_user_response.status_code == 404


def test_get_document_intelligence_returns_summary_and_detected_fields() -> None:
    repository = InMemoryDocumentRepository()
    app.dependency_overrides[get_document_repository] = lambda: repository
    created = repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="creator.pdf",
            file_type="pdf",
            file_size=1200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/creator.pdf",
        ),
    )
    repository.add_chunks(
        [
            {
                "document_id": created.id,
                "user_id": USER_ID,
                "chunk_index": 0,
                "text": "Rifki Mardiyanto uploaded X Twitter content. Email rifki@example.com. Link https://x.com/rifki.",
                "page_number": 1,
                "qdrant_point_id": "point-1",
            },
            {
                "document_id": created.id,
                "user_id": USER_ID,
                "chunk_index": 1,
                "text": "WATI MULTIVERSE made Short Post content with 3000 views and Telegram distribution.",
                "page_number": 2,
                "qdrant_point_id": "point-2",
            },
        ]
    )

    response = client.get(f"/documents/{created.id}/intelligence", headers=auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert body["document_id"] == created.id
    assert body["chunk_count"] == 2
    assert "Rifki Mardiyanto" in body["summary"]
    assert "rifki@example.com" in body["emails"]
    assert "https://x.com/rifki" in body["links"]
    assert "Rifki Mardiyanto" in body["candidate_names"]
    assert body["suggested_questions"]


def test_get_document_chunks_pages_numbered_rows() -> None:
    repository = InMemoryDocumentRepository()
    app.dependency_overrides[get_document_repository] = lambda: repository
    created = repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="laporan.pdf",
            file_type="pdf",
            file_size=8200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/laporan.pdf",
        ),
    )
    repository.add_chunks(
        [
            {
                "document_id": created.id,
                "user_id": USER_ID,
                "chunk_index": index,
                "text": f"  chunk   {index} body text   with whitespace  ",
                "page_number": index + 1,
                "qdrant_point_id": f"point-{index}",
            }
            for index in range(25)
        ]
    )

    first = client.get(f"/documents/{created.id}/chunks", headers=auth_headers())
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["total"] == 25
    assert first_body["page"] == 1
    assert first_body["page_size"] == 20
    assert [item["chunk_index"] for item in first_body["items"][:3]] == [0, 1, 2]
    assert first_body["items"][0]["preview"] == "chunk 0 body text with whitespace"
    assert first_body["items"][0]["page_number"] == 1

    second = client.get(
        f"/documents/{created.id}/chunks?page=2&page_size=20", headers=auth_headers()
    )
    second_body = second.json()
    assert len(second_body["items"]) == 5
    assert second_body["items"][0]["chunk_index"] == 20

    oversized = client.get(
        f"/documents/{created.id}/chunks?page_size=500", headers=auth_headers()
    )
    assert oversized.status_code == 422

    other_user = client.get(
        f"/documents/{created.id}/chunks", headers=auth_headers("other-user")
    )
    assert other_user.status_code == 404


def test_generate_document_ai_brief_uses_document_chunks() -> None:
    repository = InMemoryDocumentRepository()
    answer_generator = FakeAnswerGenerator()
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_document_answer_generator] = lambda: answer_generator
    created = repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="creator.pdf",
            file_type="pdf",
            file_size=1200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/creator.pdf",
        ),
    )
    repository.add_chunks(
        [
            {
                "document_id": created.id,
                "user_id": USER_ID,
                "chunk_index": 0,
                "text": "Rifki Mardiyanto uploaded X Twitter content with 3000 views.",
                "page_number": 1,
                "qdrant_point_id": "point-1",
            },
            {
                "document_id": created.id,
                "user_id": USER_ID,
                "chunk_index": 1,
                "text": "Telegram appears in a smaller number of creator responses.",
                "page_number": 2,
                "qdrant_point_id": "point-2",
            },
        ]
    )

    response = client.post(f"/documents/{created.id}/brief", headers=auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "document_id": created.id,
        "brief": "AI brief: creator responses are dominated by X/Twitter content.",
    }
    assert "creator.pdf" in answer_generator.prompt
    assert "Rifki Mardiyanto uploaded X Twitter content" in answer_generator.prompt
    assert "Brief selesai" in answer_generator.prompt


def test_create_document_with_unsupported_file_type_returns_422() -> None:
    response = client.post(
        "/documents",
        json={
            "filename": "archive.zip",
            "file_type": "zip",
            "file_size": 1200,
            "storage_path": f"{USER_ID}/{DOCUMENT_ID}/archive.zip",
        },
        headers=auth_headers(),
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "storage_path",
    [
        "other-user/file.pdf",
        f"{USER_ID}/../secret.pdf",
        f"{USER_ID}/policy.pdf",
        f"{USER_ID}/not-a-uuid/policy.pdf",
        f"{USER_ID}/{DOCUMENT_ID}/other.pdf",
        f"{USER_ID}/{DOCUMENT_ID}/policy.pdf/extra",
    ],
)
def test_create_document_with_invalid_storage_path_returns_422(storage_path: str) -> None:
    response = client.post(
        "/documents",
        json={
            "filename": "policy.pdf",
            "file_type": "pdf",
            "file_size": 1200,
            "storage_path": storage_path,
        },
        headers=auth_headers(),
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("filename", "file_type", "storage_path"),
    [
        ("folder/policy.pdf", "pdf", f"{USER_ID}/{DOCUMENT_ID}/policy.pdf"),
        ("folder\\policy.pdf", "pdf", f"{USER_ID}/{DOCUMENT_ID}/policy.pdf"),
        ("../policy.pdf", "pdf", f"{USER_ID}/{DOCUMENT_ID}/policy.pdf"),
        ("policy.pdf", "docx", f"{USER_ID}/{DOCUMENT_ID}/policy.pdf"),
        ("policy.docx", "pdf", f"{USER_ID}/{DOCUMENT_ID}/policy.docx"),
        ("policy.pdf", "pdf", f"/{USER_ID}/{DOCUMENT_ID}/policy.pdf"),
        ("policy.pdf", "pdf", f"{USER_ID}//{DOCUMENT_ID}/policy.pdf"),
        ("policy.pdf", "pdf", f"{USER_ID}\\{DOCUMENT_ID}\\policy.pdf"),
        ("policy.pdf", "pdf", f"{USER_ID}/{DOCUMENT_ID}/policy.docx"),
    ],
)
def test_create_document_with_invalid_metadata_returns_422(
    filename: str,
    file_type: str,
    storage_path: str,
) -> None:
    response = client.post(
        "/documents",
        json={
            "filename": filename,
            "file_type": file_type,
            "file_size": 1200,
            "storage_path": storage_path,
        },
        headers=auth_headers(),
    )

    assert response.status_code == 422


@pytest.mark.parametrize("file_size", [0, 50 * 1024 * 1024 + 1])
def test_create_document_with_invalid_file_size_returns_422(file_size: int) -> None:
    response = client.post(
        "/documents",
        json={
            "filename": "policy.pdf",
            "file_type": "pdf",
            "file_size": file_size,
            "storage_path": f"{USER_ID}/{DOCUMENT_ID}/policy.pdf",
        },
        headers=auth_headers(),
    )

    assert response.status_code == 422


def test_upload_pdf_creates_document_and_stores_bytes() -> None:
    storage = InMemoryDocumentStorage()
    app.dependency_overrides[get_document_storage] = lambda: storage

    response = client.post(
        "/documents/upload",
        files={"file": ("policy.pdf", b"%PDF-1.7 policy", "application/pdf")},
        headers=auth_headers(),
    )

    assert response.status_code == 201
    created_document = response.json()
    assert created_document["user_id"] == USER_ID
    assert created_document["filename"] == "policy.pdf"
    assert created_document["file_type"] == "pdf"
    assert created_document["file_size"] == len(b"%PDF-1.7 policy")
    assert created_document["storage_path"].startswith(f"{USER_ID}/")
    assert storage.objects[created_document["storage_path"]] == b"%PDF-1.7 policy"


def test_upload_zip_returns_422() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("archive.zip", b"zip bytes", "application/zip")},
        headers=auth_headers(),
    )

    assert response.status_code == 422


def test_upload_mismatched_content_type_and_filename_returns_422() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("archive.zip", b"%PDF-1.7", "application/pdf")},
        headers=auth_headers(),
    )

    assert response.status_code == 422


def test_upload_empty_pdf_returns_422() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("empty.pdf", b"", "application/pdf")},
        headers=auth_headers(),
    )

    assert response.status_code == 422


def test_upload_oversized_pdf_returns_422_before_storage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    storage = InMemoryDocumentStorage()
    app.dependency_overrides[get_document_storage] = lambda: storage
    monkeypatch.setattr(document_routes, "MAX_UPLOAD_BYTES", 8)

    response = client.post(
        "/documents/upload",
        files={"file": ("policy.pdf", b"%PDF-1.7\n", "application/pdf")},
        headers=auth_headers(),
    )

    assert response.status_code == 422
    assert storage.objects == {}


def test_delete_document_removes_owned_document_and_storage_object() -> None:
    repository = InMemoryDocumentRepository()
    storage = InMemoryDocumentStorage()
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_document_storage] = lambda: storage
    created = repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="policy.pdf",
            file_type="pdf",
            file_size=1200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/policy.pdf",
        ),
    )
    storage.objects[created.storage_path] = b"%PDF"

    response = client.delete(f"/documents/{created.id}", headers=auth_headers())

    assert response.status_code == 204
    assert repository.get_document(USER_ID, created.id) is None
    assert created.storage_path not in storage.objects


def test_delete_document_returns_404_for_other_user_document() -> None:
    repository = InMemoryDocumentRepository()
    app.dependency_overrides[get_document_repository] = lambda: repository
    created = repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="policy.pdf",
            file_type="pdf",
            file_size=1200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/policy.pdf",
        ),
    )

    response = client.delete(f"/documents/{created.id}", headers=auth_headers("other-user"))

    assert response.status_code == 404
    assert repository.get_document(USER_ID, created.id) is not None


class FailingVectorCleanup:
    def delete_document_vectors(self, user_id: str, document_id: str) -> None:
        raise RuntimeError("qdrant unreachable")


class FailingStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    async def upload_document(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
    ) -> None:
        self.objects[storage_path] = content

    async def delete_document(self, storage_path: str) -> None:
        raise RuntimeError("storage down")


def seed_document(repository: InMemoryDocumentRepository) -> DocumentResponse:
    return repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="probe-latency.pdf",
            file_type="pdf",
            file_size=900,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/probe-latency.pdf",
        ),
    )


def test_delete_document_names_the_chunk_step_when_vector_cleanup_fails() -> None:
    repository = InMemoryDocumentRepository()
    storage = InMemoryDocumentStorage()
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_document_storage] = lambda: storage
    app.dependency_overrides[get_document_vector_cleanup] = lambda: FailingVectorCleanup()
    created = seed_document(repository)
    storage.objects[created.storage_path] = b"%PDF"

    response = client.delete(f"/documents/{created.id}", headers=auth_headers())

    assert response.status_code == 502
    assert "indexed chunks" in response.json()["detail"]
    assert repository.get_document(USER_ID, created.id) is not None
    assert created.storage_path in storage.objects


def test_delete_document_names_the_file_step_when_storage_delete_fails() -> None:
    repository = InMemoryDocumentRepository()
    storage = FailingStorage()
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_document_storage] = lambda: storage
    app.dependency_overrides[get_document_vector_cleanup] = lambda: NoopDocumentVectorCleanup()
    created = seed_document(repository)

    response = client.delete(f"/documents/{created.id}", headers=auth_headers())

    assert response.status_code == 502
    assert "stored file" in response.json()["detail"]
    assert repository.get_document(USER_ID, created.id) is not None


def test_delete_document_succeeds_without_vectors_or_stored_file() -> None:
    repository = InMemoryDocumentRepository()
    storage = InMemoryDocumentStorage()
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_document_storage] = lambda: storage
    app.dependency_overrides[get_document_vector_cleanup] = lambda: NoopDocumentVectorCleanup()
    created = seed_document(repository)

    response = client.delete(f"/documents/{created.id}", headers=auth_headers())

    assert response.status_code == 204
    assert repository.get_document(USER_ID, created.id) is None


def test_retry_failed_document_resets_processing_state() -> None:
    repository = InMemoryDocumentRepository()
    app.dependency_overrides[get_document_repository] = lambda: repository
    created = repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="policy.pdf",
            file_type="pdf",
            file_size=1200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/policy.pdf",
        ),
    )
    repository.mark_failed(created.id, "Extraction failed")

    response = client.post(f"/documents/{created.id}/retry", headers=auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "processing"
    assert body["error_message"] is None
    assert body["chunk_count"] == 0


def test_retry_ready_document_returns_409() -> None:
    repository = InMemoryDocumentRepository()
    app.dependency_overrides[get_document_repository] = lambda: repository
    created = repository.create_document(
        USER_ID,
        DocumentCreate(
            filename="policy.pdf",
            file_type="pdf",
            file_size=1200,
            storage_path=f"{USER_ID}/{DOCUMENT_ID}/policy.pdf",
        ),
    )

    response = client.post(f"/documents/{created.id}/retry", headers=auth_headers())

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_supabase_storage_url_encodes_path_segments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, str] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

    class FakeAsyncClient:
        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(
            self,
            url: str,
            content: bytes,
            headers: dict[str, str],
        ) -> FakeResponse:
            captured["url"] = url
            return FakeResponse()

    monkeypatch.setattr("app.documents.storage.httpx.AsyncClient", FakeAsyncClient)

    storage = SupabaseDocumentStorage(
        "https://example.supabase.co",
        "service-role-key",
        "documents",
    )

    await storage.upload_document(
        f"{USER_ID}/{uuid4()}/policy #1.pdf",
        b"pdf",
        "application/pdf",
    )

    assert "/documents/user-documents-123/" in captured["url"]
    assert "policy #1.pdf" not in captured["url"]
    assert "%23" in captured["url"]
    assert "policy%20%231.pdf" in captured["url"]


@pytest.mark.asyncio
async def test_supabase_storage_delete_tolerates_missing_object(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeResponse:
        status_code = 404

        def raise_for_status(self) -> None:
            raise RuntimeError("object not found")

    class FakeAsyncClient:
        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def delete(
            self,
            url: str,
            json: dict[str, list[str]],
            headers: dict[str, str],
        ) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr("app.documents.storage.httpx.AsyncClient", FakeAsyncClient)

    storage = SupabaseDocumentStorage(
        "https://example.supabase.co",
        "service-role-key",
        "documents",
    )

    await storage.delete_document(f"{USER_ID}/{DOCUMENT_ID}/probe-latency.pdf")
