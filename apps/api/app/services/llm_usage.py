"""The write boundary of the LLM cost ledger.

`app/services/llm_budget.py` decides whether a call may happen; this decides what it cost.
The two stay apart because they fail differently: a spent budget is the user's answer (a 429),
while a failed ledger write must never be one.
"""

from __future__ import annotations

import logging
from typing import TypeVar

from app.core.config import Settings
from app.usage.models import (
    LlmCallRow,
    LlmPurpose,
    TokenUsage,
    UsageSink,
    cost_for_call,
)
from app.usage.repository import LlmCallRepository

logger = logging.getLogger(__name__)

T = TypeVar("T")


def llm_usage_sink(
    repository: LlmCallRepository,
    settings: Settings,
    user_id: str,
    purpose: LlmPurpose,
) -> UsageSink:
    """Bind one user and one purpose to the ledger, and make the write unraisable.

    The caller is inside a completed LLM response: the user's answer is already paid for and
    sitting in `content`. Letting a PostgREST hiccup escape from here would turn a good answer
    into a 502 (chat) or a lost brief (documents), so every failure is logged and dropped.
    The gap is visible in the aggregate as a missing row, not as a broken request.
    """

    def record(usage: TokenUsage) -> None:
        cost, basis = cost_for_call(usage, settings)
        row = LlmCallRow(
            user_id=user_id,
            purpose=purpose,
            model=usage.model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            reasoning_tokens=usage.reasoning_tokens,
            cost_usd=cost,
            cost_basis=basis,
        )
        try:
            repository.record_call(row)
        except Exception:  # noqa: BLE001 - bookkeeping never costs a user their answer
            logger.exception(
                "could not ledger the %s llm call for user %s", purpose, user_id
            )

    return record


def attach_usage_ledger(
    target: T,
    repository: LlmCallRepository,
    settings: Settings,
    user_id: str,
    purpose: LlmPurpose,
) -> T:
    """Point a client that builds real requests at the ledger, and hand it back.

    Duck-typed on purpose: test doubles, the eval harness's stand-ins and a budget wrapper
    built over nothing answer without an HTTP call, and an unrecorded call is a gap in a
    table - not a reason to break the thing that served it.
    """
    attach = getattr(target, "attach_usage_sink", None)
    if callable(attach):
        attach(llm_usage_sink(repository, settings, user_id, purpose))
    return target
