import json
import logging
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import HTTPException

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    role: str


def decode_supabase_jwt(
    token: str,
    jwt_secret: str = "",
    jwks_url: str = "",
    issuer: str = "",
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
                issuer=issuer or None,
            )
            return _current_user_from_payload(payload)

        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp"]},
            issuer=issuer or None,
        )
        return _current_user_from_payload(payload)
    # A JWKS fetch failure is an outage of the auth infrastructure, not proof of a
    # bad token: answering 401 would tell a valid user to log in again while every
    # request keeps failing. PyJWT wraps only URLError/TimeoutError in
    # PyJWKClientConnectionError; a non-JSON body escapes as a bare JSONDecodeError,
    # which used to surface as an unhandled (and CORS-less) 500.
    except jwt.PyJWKClientConnectionError as exc:
        logger.exception("could not fetch JWKS from %s", jwks_url)
        raise HTTPException(
            status_code=503,
            detail="Authentication service temporarily unavailable",
        ) from exc
    except json.JSONDecodeError as exc:
        logger.exception("JWKS endpoint returned a non-JSON body from %s", jwks_url)
        raise HTTPException(
            status_code=503,
            detail="Authentication service temporarily unavailable",
        ) from exc
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
