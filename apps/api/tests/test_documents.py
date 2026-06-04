from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app.documents import routes as document_routes
from app.documents.models import DocumentCreate
from app.documents.repository import InMemoryDocumentRepository
from app.main import app
from app.documents.routes import get_document_repository, get_document_storage
from app.documents.storage import InMemoryDocumentStorage, SupabaseDocumentStorage
from app.core.config import Settings, get_settings


USER_ID = "user-documents-123"
DOCUMENT_ID = "11111111-1111-4111-8111-111111111111"

client = TestClient(app)


@pytest.fixture(autouse=True)
def document_repository_override() -> None:
    repository = InMemoryDocumentRepository()
    storage = InMemoryDocumentStorage()
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_document_storage] = lambda: storage
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
