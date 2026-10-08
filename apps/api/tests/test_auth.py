import base64
import json
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from jwt.algorithms import ECAlgorithm

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser, decode_supabase_jwt, get_jwks_client
from app.core.config import Settings, get_settings
from app.main import app

client = TestClient(app)


def future_timestamp() -> int:
    return int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp())


def past_timestamp() -> int:
    return int((datetime.now(timezone.utc) - timedelta(minutes=5)).timestamp())


def _unsigned_token(kid: str = "test-key") -> str:
    # Structurally valid (three base64url segments) so PyJWKClient parses the
    # header and reaches the JWKS fetch, where every failure under test happens.
    def segment(data: dict[str, object]) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    header = segment({"alg": "RS256", "typ": "JWT", "kid": kid})
    payload = segment({"sub": "user-123", "aud": "authenticated", "exp": future_timestamp()})
    return f"{header}.{payload}.c2ln"


class _JwksServer:
    """A real socket, because the failures under test live between urllib and
    json.load inside PyJWKClient.fetch_data — an in-process double cannot
    reproduce them."""

    def __init__(self, status: int, body: bytes) -> None:
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args: object) -> None:
                pass

        self._server = HTTPServer(("127.0.0.1", 0), Handler)
        self.port = self._server.server_address[1]
        threading.Thread(target=self._server.serve_forever, daemon=True).start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}/jwks"

    def close(self) -> None:
        self._server.shutdown()
        self._server.server_close()


@contextmanager
def _served_jwks(status: int, body: bytes) -> Iterator[str]:
    server = _JwksServer(status, body)
    try:
        yield server.url
    finally:
        server.close()


def test_valid_hs256_jwt_with_authenticated_audience_returns_current_user() -> None:
    token = jwt.encode(
        {
            "sub": "user-123",
            "email": "user@example.com",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": future_timestamp(),
        },
        "test-secret",
        algorithm="HS256",
    )

    user = decode_supabase_jwt(token, "test-secret")

    assert user == CurrentUser(
        id="user-123",
        email="user@example.com",
        role="authenticated",
    )


def test_valid_es256_jwt_with_jwks_returns_current_user(monkeypatch: pytest.MonkeyPatch) -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    token = jwt.encode(
        {
            "sub": "ecc-user-123",
            "email": "ecc@example.com",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": future_timestamp(),
        },
        private_key,
        algorithm="ES256",
        headers={"kid": "current-key"},
    )

    class FakeSigningKey:
        key = public_key

    class FakePyJWKClient:
        def __init__(self, url: str) -> None:
            assert url == "https://project.supabase.co/auth/v1/.well-known/jwks.json"

        def get_signing_key_from_jwt(self, jwt_token: str) -> FakeSigningKey:
            assert jwt_token == token
            return FakeSigningKey()

    monkeypatch.setattr(jwt, "PyJWKClient", FakePyJWKClient)

    user = decode_supabase_jwt(
        token,
        jwks_url="https://project.supabase.co/auth/v1/.well-known/jwks.json",
    )

    assert user == CurrentUser(
        id="ecc-user-123",
        email="ecc@example.com",
        role="authenticated",
    )


def test_jwks_client_is_cached_per_url(monkeypatch: pytest.MonkeyPatch) -> None:
    created_urls: list[str] = []

    class FakePyJWKClient:
        def __init__(self, url: str) -> None:
            created_urls.append(url)

    monkeypatch.setattr(jwt, "PyJWKClient", FakePyJWKClient)
    get_jwks_client.cache_clear()

    first = get_jwks_client("https://project.supabase.co/auth/v1/.well-known/jwks.json")
    second = get_jwks_client("https://project.supabase.co/auth/v1/.well-known/jwks.json")

    assert first is second
    assert created_urls == ["https://project.supabase.co/auth/v1/.well-known/jwks.json"]


def test_wrong_secret_raises_401() -> None:
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated", "exp": future_timestamp()},
        "test-secret",
        algorithm="HS256",
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_supabase_jwt(token, "wrong-secret")

    assert exc_info.value.status_code == 401


@pytest.mark.parametrize("subject", ["", None])
def test_missing_or_empty_subject_raises_401(subject: str | None) -> None:
    payload = {"aud": "authenticated", "exp": future_timestamp()}
    if subject is not None:
        payload["sub"] = subject
    token = jwt.encode(payload, "test-secret", algorithm="HS256")

    with pytest.raises(HTTPException) as exc_info:
        decode_supabase_jwt(token, "test-secret")

    assert exc_info.value.status_code == 401


def test_missing_expiration_raises_401() -> None:
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"},
        "test-secret",
        algorithm="HS256",
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_supabase_jwt(token, "test-secret")

    assert exc_info.value.status_code == 401


def test_expired_token_raises_401() -> None:
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated", "exp": past_timestamp()},
        "test-secret",
        algorithm="HS256",
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_supabase_jwt(token, "test-secret")

    assert exc_info.value.status_code == 401


def test_get_current_user_uses_settings_dependency_override() -> None:
    app = FastAPI()

    @app.get("/me")
    def me(user: CurrentUser = Depends(get_current_user)) -> dict[str, str | None]:
        return {"id": user.id, "email": user.email, "role": user.role}

    def override_settings() -> Settings:
        return Settings(supabase_jwt_secret="override-secret")

    app.dependency_overrides[get_settings] = override_settings
    token = jwt.encode(
        {
            "sub": "user-123",
            "email": "user@example.com",
            "aud": "authenticated",
            "exp": future_timestamp(),
        },
        "override-secret",
        algorithm="HS256",
    )

    response = TestClient(app).get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "id": "user-123",
        "email": "user@example.com",
        "role": "authenticated",
    }


def test_validate_security_rejects_default_secret_outside_development_or_test() -> None:
    settings = Settings(environment="production", supabase_jwt_secret="test-secret")

    with pytest.raises(ValueError):
        settings.validate_security()


def test_validate_security_allows_default_secret_in_test() -> None:
    Settings(environment="test", supabase_jwt_secret="test-secret").validate_security()


def test_validate_security_allows_jwks_url_in_production() -> None:
    Settings(
        environment="production",
        supabase_jwt_secret="test-secret",
        supabase_jwks_url="https://project.supabase.co/auth/v1/.well-known/jwks.json",
    ).validate_security()


def test_settings_derives_jwks_url_from_supabase_url() -> None:
    settings = Settings(supabase_url="https://project.supabase.co")

    assert (
        settings.resolved_supabase_jwks_url
        == "https://project.supabase.co/auth/v1/.well-known/jwks.json"
    )


def test_an_unreachable_jwks_endpoint_answers_503_not_401() -> None:
    server = _JwksServer(200, b'{"keys": []}')
    port = server.port
    server.close()

    with pytest.raises(HTTPException) as exc_info:
        decode_supabase_jwt(_unsigned_token(), jwks_url=f"http://127.0.0.1:{port}/jwks")

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Authentication service temporarily unavailable"


def test_a_non_json_jwks_body_answers_503_not_a_bare_500() -> None:
    # Measured on PyJWT 2.10.1: fetch_data only wraps URLError/TimeoutError, so a
    # 200 answer whose body is not JSON escaped as a bare JSONDecodeError — an
    # unhandled (and CORS-less) 500 on every authenticated request.
    with _served_jwks(200, b"<html>gateway error page</html>") as jwks_url:
        with pytest.raises(HTTPException) as exc_info:
            decode_supabase_jwt(_unsigned_token(), jwks_url=jwks_url)

    assert exc_info.value.status_code == 503


def test_an_http_error_from_the_jwks_endpoint_answers_503_not_401() -> None:
    with _served_jwks(500, b"upstream dead") as jwks_url:
        with pytest.raises(HTTPException) as exc_info:
            decode_supabase_jwt(_unsigned_token(), jwks_url=jwks_url)

    assert exc_info.value.status_code == 503


def test_a_token_with_an_unknown_kid_still_answers_401() -> None:
    # Kid mismatch is a problem with the token, not with the auth infrastructure;
    # the 503 mappings must not swallow it.
    private_key = ec.generate_private_key(ec.SECP256R1())
    jwk = ECAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    jwk["kid"] = "other-key"
    jwk["use"] = "sig"

    with _served_jwks(200, json.dumps({"keys": [jwk]}).encode()) as jwks_url:
        with pytest.raises(HTTPException) as exc_info:
            decode_supabase_jwt(_unsigned_token(), jwks_url=jwks_url)

    assert exc_info.value.status_code == 401


def test_a_jwks_outage_through_the_real_app_answers_503_with_cors_headers() -> None:
    with _served_jwks(200, b"<html>gateway error page</html>") as jwks_url:

        def override_settings() -> Settings:
            return Settings(supabase_jwks_url=jwks_url)

        app.dependency_overrides[get_settings] = override_settings
        try:
            response = client.get(
                "/documents",
                headers={
                    "Authorization": f"Bearer {_unsigned_token()}",
                    "Origin": "http://localhost:3000",
                },
            )
        finally:
            app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 503
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
