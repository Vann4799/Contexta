"""Repository selection for the LLM cost ledger."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.usage.repository import (
    LlmCallRepository,
    SupabaseLlmCallRepository,
    llm_call_repository,
)


def get_llm_call_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> LlmCallRepository:
    # Every other table in this app resolves its repository from the same two knobs, so the
    # ledger turns live at exactly the moment the rest of the data does - and a test run
    # with no credentials never writes to production.
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseLlmCallRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return llm_call_repository
