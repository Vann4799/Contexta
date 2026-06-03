from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.documents.repository import InMemoryDocumentRepository
from app.main import app
from app.documents.routes import get_document_repository, get_document_storage
from app.documents.storage import InMemoryDocumentStorage


USER_ID = "user-documents-123"

client = TestClient(app)


@pytest.fixture(autouse=True)
def document_repository_override() -> None:
    repository = InMemoryDocumentRepository()
    storage = InMemoryDocumentStorage()
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_document_storage] = lambda: storage
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
        "storage_path": f"{USER_ID}/policy.pdf",
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
        "storage_path": f"{USER_ID}/policy.pdf",
        "status": "processing",
        "error_message": None,
        "chunk_count": 0,
        "created_at": created_document["created_at"],
        "updated_at": created_document["updated_at"],
    }

    list_response = client.get("/documents", headers=auth_headers())

    assert list_response.status_code == 200
    assert list_response.json() == [created_document]


def test_create_document_with_unsupported_file_type_returns_422() -> None:
    response = client.post(
        "/documents",
        json={
            "filename": "archive.zip",
            "file_type": "zip",
            "file_size": 1200,
            "storage_path": f"{USER_ID}/archive.zip",
        },
        headers=auth_headers(),
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "storage_path",
    [
        "other-user/file.pdf",
        f"{USER_ID}/../secret.pdf",
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
        ("folder/policy.pdf", "pdf", f"{USER_ID}/policy.pdf"),
        ("folder\\policy.pdf", "pdf", f"{USER_ID}/policy.pdf"),
        ("../policy.pdf", "pdf", f"{USER_ID}/policy.pdf"),
        ("policy.pdf", "docx", f"{USER_ID}/policy.pdf"),
        ("policy.docx", "pdf", f"{USER_ID}/policy.docx"),
        ("policy.pdf", "pdf", f"/{USER_ID}/policy.pdf"),
        ("policy.pdf", "pdf", f"{USER_ID}//policy.pdf"),
        ("policy.pdf", "pdf", f"{USER_ID}\\policy.pdf"),
        ("policy.pdf", "pdf", f"{USER_ID}/policy.docx"),
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
            "storage_path": f"{USER_ID}/policy.pdf",
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
