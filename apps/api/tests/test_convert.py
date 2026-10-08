from datetime import datetime, timedelta, timezone

import fitz
import jwt
import pytest
from fastapi.testclient import TestClient

from app.convert.routes import get_markdown_converter_factory
from app.core.config import Settings, get_settings
from app.main import app


USER_ID = "user-convert-123"
client = TestClient(app)


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


@pytest.fixture(autouse=True)
def settings_override() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_jwt_secret="test-secret",
        supabase_jwks_url="",
        supabase_url="",
        supabase_service_role_key="",
    )
    yield
    app.dependency_overrides.clear()


def convert(client: TestClient = client):
    return client.post(
        "/convert/markdown",
        files={"file": ("policy.pdf", b"%PDF-1.7 policy", "application/pdf")},
        headers=auth_headers(),
    )


def test_convert_markdown_requires_auth() -> None:
    response = client.post(
        "/convert/markdown",
        files={"file": ("policy.pdf", b"%PDF-1.7 policy", "application/pdf")},
    )

    assert response.status_code == 401


def test_convert_markdown_rejects_non_pdf() -> None:
    response = client.post(
        "/convert/markdown",
        files={"file": ("notes.txt", b"plain text", "text/plain")},
        headers=auth_headers(),
    )

    assert response.status_code == 422


def test_convert_markdown_returns_the_converter_output() -> None:
    received: list[bytes] = []

    def fake_converter(content: bytes) -> str:
        received.append(content)
        return "# Converted\n\nPDF body"

    app.dependency_overrides[get_markdown_converter_factory] = lambda: (
        lambda: fake_converter
    )

    response = convert()

    assert response.status_code == 200
    assert response.json() == {
        "filename": "policy.pdf",
        "markdown": "# Converted\n\nPDF body",
        "size_bytes": len(b"%PDF-1.7 policy"),
        "output_filename": "policy.md",
    }
    # The extractor works on the uploaded bytes; the old path wrote a temp file.
    assert received == [b"%PDF-1.7 policy"]


def test_convert_markdown_returns_clean_500_on_converter_failure() -> None:
    def failing_converter(content: bytes) -> str:
        raise RuntimeError("raw converter traceback detail")

    app.dependency_overrides[get_markdown_converter_factory] = lambda: (
        lambda: failing_converter
    )

    response = convert()

    assert response.status_code == 500
    assert response.json() == {"detail": "Unable to convert PDF to Markdown."}
    assert "raw converter traceback detail" not in response.text


def pdf_drawn_bottom_to_top() -> bytes:
    # Text placed from the bottom of the page upwards, so the content stream order and
    # the reading order disagree. This is the shape that came out of Convert reversed.
    document = fitz.open()
    page = document.new_page()
    for y, text in ((600, "baris bawah"), (350, "baris tengah"), (90, "BARIS ATAS")):
        page.insert_text((72, y), text, fontsize=11)
    content = document.tobytes()
    document.close()
    return content


def test_convert_markdown_uses_the_indexing_extractor() -> None:
    """Convert and indexing must agree on the text, or the download is not the corpus."""
    from contexta_rag.extraction import DocumentTextExtractor, to_markdown

    content = pdf_drawn_bottom_to_top()

    response = client.post(
        "/convert/markdown",
        files={"file": ("lecture.pdf", content, "application/pdf")},
        headers=auth_headers(),
    )

    assert response.json()["markdown"] == to_markdown(
        DocumentTextExtractor().extract(content, "pdf")
    )
