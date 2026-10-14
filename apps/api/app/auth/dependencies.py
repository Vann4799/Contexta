from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.supabase_jwt import CurrentUser, decode_supabase_jwt
from app.core.config import Settings, get_settings


bearer_scheme = HTTPBearer(auto_error=True)
optional_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    return decode_supabase_jwt(
        credentials.credentials,
        jwt_secret=settings.supabase_jwt_secret,
        jwks_url=settings.resolved_supabase_jwks_url,
        issuer=settings.resolved_auth_issuer,
    )


def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(optional_bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser | None:
    """Identify the caller when a token is present and valid, without requiring one.

    A bad token reads as anonymous rather than 401: the endpoints that use this report
    system status, and an expired session should not turn a health card into an error.
    A 503 from the auth service still propagates — that is a real outage, not a bad token.
    """
    if credentials is None or not credentials.credentials:
        return None

    try:
        return decode_supabase_jwt(
            credentials.credentials,
            jwt_secret=settings.supabase_jwt_secret,
            jwks_url=settings.resolved_supabase_jwks_url,
            issuer=settings.resolved_auth_issuer,
        )
    except HTTPException as error:
        if error.status_code == status.HTTP_401_UNAUTHORIZED:
            return None
        raise
