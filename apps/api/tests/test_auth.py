import jwt
import pytest
from fastapi import HTTPException

from app.auth.supabase_jwt import CurrentUser, decode_supabase_jwt


def test_valid_hs256_jwt_with_authenticated_audience_returns_current_user() -> None:
    token = jwt.encode(
        {
            "sub": "user-123",
            "email": "user@example.com",
            "role": "authenticated",
            "aud": "authenticated",
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


def test_wrong_secret_raises_401() -> None:
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"},
        "test-secret",
        algorithm="HS256",
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_supabase_jwt(token, "wrong-secret")

    assert exc_info.value.status_code == 401


@pytest.mark.parametrize("subject", ["", None])
def test_missing_or_empty_subject_raises_401(subject: str | None) -> None:
    payload = {"aud": "authenticated"}
    if subject is not None:
        payload["sub"] = subject
    token = jwt.encode(payload, "test-secret", algorithm="HS256")

    with pytest.raises(HTTPException) as exc_info:
        decode_supabase_jwt(token, "test-secret")

    assert exc_info.value.status_code == 401
