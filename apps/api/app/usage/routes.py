"""GET /usage/llm: what this user's LLM calls actually cost."""

from __future__ import annotations

from contextlib import contextmanager
import logging
from typing import Annotated, Iterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.usage.dependencies import get_llm_call_repository
from app.usage.models import LlmUsageSummaryResponse
from app.usage.repository import (
    DEFAULT_USAGE_WINDOW_DAYS,
    LlmCallRepository,
    MAX_USAGE_WINDOW_DAYS,
)

router = APIRouter(prefix="/usage", tags=["usage"])
logger = logging.getLogger(__name__)


@contextmanager
def usage_store() -> Iterator[None]:
    """A PostgREST failure becomes a 503 that still carries CORS headers.

    Same reason as `account_store()`: an exception that escapes the route is answered by
    Starlette's ServerErrorMiddleware, which sits outside CORSMiddleware, and the browser
    then reports a CORS failure for what was a database outage. The provider's own error
    text is logged only - it echoes request bodies, and this response is reachable by any
    signed-in user.
    """
    try:
        yield
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        logger.exception("llm usage summary request failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "llm_usage_store_unavailable",
                "message": "LLM usage summary is unavailable. Retry shortly.",
            },
        ) from exc


@router.get("/llm", response_model=LlmUsageSummaryResponse)
def llm_usage(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[LlmCallRepository, Depends(get_llm_call_repository)],
    days: Annotated[
        int,
        Query(ge=1, le=MAX_USAGE_WINDOW_DAYS, description="Window length, in UTC days."),
    ] = DEFAULT_USAGE_WINDOW_DAYS,
) -> LlmUsageSummaryResponse:
    """This user's own totals only.

    The id comes from the caller's JWT and is the sole scoping argument the RPC receives, so
    no query parameter can point this at another workspace's spend.
    """
    with usage_store():
        summary = repository.summary(current_user.id, days)

    try:
        return LlmUsageSummaryResponse.model_validate(summary)
    except ValidationError as exc:
        # The aggregate RPC and this model are supposed to move together. If they did not,
        # a half-rendered cost report is worse than an honest retry.
        logger.exception("llm usage summary returned an unexpected shape")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "llm_usage_malformed",
                "message": "LLM usage summary returned an unexpected shape. Retry shortly.",
            },
        ) from exc
