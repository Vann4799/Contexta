from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from app.apikeys.dependencies import seconds_to_next_day
from app.auth.supabase_jwt import CurrentUser
from app.chat.llm import AnswerGenerator, QueryRewriter
from app.core.config import Settings

# The daily model allowance is counted in-process: a durable number would need a table and
# a migration on live Supabase, which is Vann's call. So this is an abuse brake, not billing
# -- with several workers each keeps its own count and a restart clears them.
TRACKED_USER_LIMIT = 10_000


def utc_day(now: datetime | None = None) -> str:
    return (now or datetime.now(timezone.utc)).strftime("%Y-%m-%d")


class LlmDayBudget:
    def __init__(self, tracked_limit: int = TRACKED_USER_LIMIT) -> None:
        self._used: dict[str, tuple[str, int]] = {}
        self._tracked_limit = tracked_limit

    def used_today(self, user_id: str, day: str | None = None) -> int:
        current = day or utc_day()
        seen_day, count = self._used.get(user_id, (current, 0))
        return count if seen_day == current else 0

    def allows(self, user_id: str, limit: int, day: str | None = None) -> bool:
        return limit <= 0 or self.used_today(user_id, day) < limit

    def charge(self, user_id: str, limit: int, day: str | None = None) -> None:
        """Take one unit, or refuse the call that is about to cost money."""
        if limit <= 0:
            return
        current = day or utc_day()
        used = self.used_today(user_id, current)
        if used >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "llm_day_limit_exceeded",
                    "message": (
                        f"Daily AI limit of {limit} model calls reached. "
                        "The allowance resets at midnight UTC."
                    ),
                },
                headers={"Retry-After": str(seconds_to_next_day())},
            )
        self._used[user_id] = (current, used + 1)
        if len(self._used) > self._tracked_limit:
            self._used = {
                name: seen for name, seen in self._used.items() if seen[0] == current
            }

    def reset(self) -> None:
        self._used.clear()


llm_day_budget = LlmDayBudget()


class BudgetedAnswerGenerator:
    """Charges the day for each prompt that actually reaches the answer model.

    Charged here instead of in the routes because several chat questions are answered from
    the chunk tables without any model call; those must not spend the allowance.
    """

    def __init__(
        self,
        inner: AnswerGenerator,
        budget: LlmDayBudget,
        user_id: str,
        limit: int,
    ) -> None:
        self._inner = inner
        self._budget = budget
        self._user_id = user_id
        self._limit = limit

    def generate_answer(self, prompt: str) -> str:
        self._budget.charge(self._user_id, self._limit)
        return self._inner.generate_answer(prompt)


class BudgetedQueryRewriter:
    """Silently declines to rewrite once the day is spent.

    Its caller treats a rewrite as an optimization and swallows every exception, so raising
    here would cost a unit for a call that never happened and still return an answer.
    """

    def __init__(
        self,
        inner: QueryRewriter,
        budget: LlmDayBudget,
        user_id: str,
        limit: int,
    ) -> None:
        self._inner = inner
        self._budget = budget
        self._user_id = user_id
        self._limit = limit

    def rewrite_query(self, question: str, history: list) -> str | None:
        if not self._budget.allows(self._user_id, self._limit):
            return None
        self._budget.charge(self._user_id, self._limit)
        return self._inner.rewrite_query(question, history)


def budgeted_answer_generator(
    inner: AnswerGenerator,
    current_user: CurrentUser,
    settings: Settings,
    budget: LlmDayBudget = llm_day_budget,
) -> AnswerGenerator:
    if settings.llm_day_limit <= 0:
        return inner
    return BudgetedAnswerGenerator(
        inner, budget, current_user.id, settings.llm_day_limit
    )


def budgeted_query_rewriter(
    inner: QueryRewriter | None,
    current_user: CurrentUser,
    settings: Settings,
    budget: LlmDayBudget = llm_day_budget,
) -> QueryRewriter | None:
    if inner is None or settings.llm_day_limit <= 0:
        return inner
    return BudgetedQueryRewriter(inner, budget, current_user.id, settings.llm_day_limit)
