from dataclasses import dataclass

import jwt
from fastapi import HTTPException


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    role: str


def decode_supabase_jwt(token: str, jwt_secret: str) -> CurrentUser:
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        ) from exc

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
