from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.supabase_jwt import CurrentUser, decode_supabase_jwt
from app.core.config import Settings, get_settings


bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    return decode_supabase_jwt(
        credentials.credentials,
        jwt_secret=settings.supabase_jwt_secret,
        jwks_url=settings.resolved_supabase_jwks_url,
    )
