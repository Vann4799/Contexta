import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser, decode_supabase_jwt
from app.core.config import Settings, get_settings


def future_timestamp() -> int:
    return int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp())


def past_timestamp() -> int:
    return int((datetime.now(timezone.utc) - timedelta(minutes=5)).timestamp())


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
