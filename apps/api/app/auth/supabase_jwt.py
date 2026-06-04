from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import HTTPException


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    role: str


def decode_supabase_jwt(
    token: str,
    jwt_secret: str = "",
    jwks_url: str = "",
) -> CurrentUser:
    try:
        if jwks_url:
            signing_key = get_jwks_client(jwks_url).get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
                options={"require": ["exp"]},
            )
            return _current_user_from_payload(payload)

        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp"]},
        )
        return _current_user_from_payload(payload)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        ) from exc


@lru_cache(maxsize=8)
def get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_url)


def _current_user_from_payload(payload: dict[str, object]) -> CurrentUser:
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    email = payload.get("email")
    role = payload.get("role", "authenticated")

    return CurrentUser(
        id=subject,
        email=email if isinstance(email, str) else None,
        role=role if isinstance(role, str) else "authenticated",
    )
