from contextlib import contextmanager
import logging
from typing import Annotated, Iterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.account.models import AccountSummaryResponse
from app.account.repository import AccountRepository, SupabaseAccountRepository, account_repository
from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings

router = APIRouter(prefix="/account", tags=["account"])
logger = logging.getLogger(__name__)


def get_account_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AccountRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseAccountRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return account_repository


@contextmanager
def account_store() -> Iterator[None]:
    """A PostgREST failure becomes a 503 that still carries CORS headers.

    An exception that escapes the route is answered by Starlette's ServerErrorMiddleware,
    which sits outside CORSMiddleware, and the browser then reports "blocked by CORS policy"
    with the real cause only in the server log.
    """
    try:
        yield
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        logger.exception("account summary request failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "account_summary_unavailable",
                "message": "Account summary is unavailable. Retry shortly.",
            },
        ) from exc


@router.get("/summary", response_model=AccountSummaryResponse)
def account_summary(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[AccountRepository, Depends(get_account_repository)],
) -> AccountSummaryResponse:
    # The id is only ever the one resolved from the caller's JWT; no request field can point
    # this at another workspace.
    with account_store():
        summary = repository.summary(current_user.id)

    try:
        return AccountSummaryResponse.model_validate(summary)
    except ValidationError as exc:
        # The RPC and this model are supposed to move together. If they did not, that is a
        # server fault, and the code has to say so instead of the page rendering zeros.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "account_summary_malformed",
                "message": "Account summary returned an unexpected shape. Retry shortly.",
            },
        ) from exc
