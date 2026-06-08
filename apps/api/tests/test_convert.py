from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.convert.routes import get_markdown_converter_factory
from app.core.config import Settings, get_settings
from app.main import app


USER_ID = "user-convert-123"
client = TestClient(app)


class FakeConversionResult:
    text_content = "# Converted\n\nPDF body"


class FakeMarkdownConverter:
    def __init__(self) -> None:
        self.received_path = ""

    def convert(self, path: str) -> FakeConversionResult:
        self.received_path = path
        return FakeConversionResult()


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


def test_convert_markdown_returns_markitdown_output() -> None:
    converter = FakeMarkdownConverter()
    app.dependency_overrides[get_markdown_converter_factory] = lambda: lambda: converter

    response = client.post(
        "/convert/markdown",
        files={"file": ("policy.pdf", b"%PDF-1.7 policy", "application/pdf")},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "filename": "policy.pdf",
        "markdown": "# Converted\n\nPDF body",
        "size_bytes": len(b"%PDF-1.7 policy"),
        "output_filename": "policy.md",
    }
    assert converter.received_path.endswith(".pdf")


def test_convert_markdown_returns_clean_500_on_converter_failure() -> None:
    class FailingMarkdownConverter:
        def convert(self, path: str) -> FakeConversionResult:
            raise RuntimeError("raw converter traceback detail")

    app.dependency_overrides[get_markdown_converter_factory] = (
        lambda: lambda: FailingMarkdownConverter()
    )

    response = client.post(
        "/convert/markdown",
        files={"file": ("policy.pdf", b"%PDF-1.7 policy", "application/pdf")},
        headers=auth_headers(),
    )

    assert response.status_code == 500
    assert response.json() == {"detail": "Unable to convert PDF to Markdown."}
