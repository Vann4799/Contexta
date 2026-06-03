from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.supabase_jwt import CurrentUser, decode_supabase_jwt
from app.core.config import get_settings


bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> CurrentUser:
    settings = get_settings()
    return decode_supabase_jwt(credentials.credentials, settings.supabase_jwt_secret)
