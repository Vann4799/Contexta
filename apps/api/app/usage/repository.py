"""PostgREST access to the LLM cost ledger.

Persistence here is Supabase over httpx with the service role key - there is no ORM and no
psycopg connection in this app - so an aggregate read is one RPC (PostgREST has no GROUP BY),
and a write is one insert per LLM call.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Callable, Protocol

import httpx

from app.usage.models import LlmCallRow

# The window the RPC and this mirror agree on. Longer than a page of dashboards needs and
# shorter than the 90-day retention, so a caller cannot ask for rows the worker may have
# already pruned and conclude the model stopped answering.
DEFAULT_USAGE_WINDOW_DAYS = 30
MAX_USAGE_WINDOW_DAYS = 90


class LlmCallRepository(Protocol):
    def record_call(self, row: LlmCallRow) -> None:
        ...

    def summary(self, user_id: str, days: int) -> dict[str, object]:
        ...


def _now() -> datetime:
    return datetime.now(timezone.utc)


class InMemoryLlmCallRepository:
    """Re-implements llm_usage_summary() in Python over plain row lists.

    The live figure comes from SQL the API cannot test, so this mirror is what the route and
    the browser contract are tested against. Keep it in step with
    infra/supabase/migrations/0013_llm_calls.sql: the rules that have to agree are the UTC day
    boundary, the window floor, null-vs-zero for each sum, and the by_purpose ordering.
    """

    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        self._now = clock or _now
        self.rows: list[dict[str, object]] = []

    def record_call(self, row: LlmCallRow) -> None:
        self.rows.append({**row.as_row(), "created_at": self._now()})

    def summary(self, user_id: str, days: int) -> dict[str, object]:
        now = self._now()
        floor = (now - timedelta(days=days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        scoped = [
            row
            for row in self.rows
            if row["user_id"] == user_id and row["created_at"] >= floor  # type: ignore[operator]
        ]

        # Every day in the window is named even when nothing was called, so a chart draws
        # a flat line instead of dropping the gap.
        by_day: dict[str, dict[str, object]] = {}
        for offset in range(days - 1, -1, -1):
            day = (now - timedelta(days=offset)).strftime("%Y-%m-%d")
            by_day[day] = {
                "date": day,
                "calls": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "cost_usd": None,
            }

        grouped: dict[str, dict[str, object]] = {}
        for row in scoped:
            day = str(row["created_at"])[:10]  # type: ignore[arg-type]
            cost = _optional_float(row.get("cost_usd"))
            bucket = by_day.get(day)
            if bucket is not None:
                bucket["calls"] = int(bucket["calls"]) + 1
                bucket["prompt_tokens"] = int(bucket["prompt_tokens"]) + _count(row, "prompt_tokens")
                bucket["completion_tokens"] = int(bucket["completion_tokens"]) + _count(
                    row, "completion_tokens"
                )
                bucket["cost_usd"] = _add(bucket["cost_usd"], cost)

            purpose = str(row["purpose"])
            entry = grouped.setdefault(
                purpose,
                {
                    "purpose": purpose,
                    "calls": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "reasoning_tokens": 0,
                    "cost_usd": None,
                },
            )
            entry["calls"] = int(entry["calls"]) + 1
            entry["prompt_tokens"] = int(entry["prompt_tokens"]) + _count(row, "prompt_tokens")
            entry["completion_tokens"] = int(entry["completion_tokens"]) + _count(
                row, "completion_tokens"
            )
            entry["reasoning_tokens"] = int(entry["reasoning_tokens"]) + _count(
                row, "reasoning_tokens"
            )
            entry["cost_usd"] = _add(entry["cost_usd"], cost)

        return {
            "days": days,
            "totals": {
                "calls": len(scoped),
                "calls_without_tokens": sum(1 for row in scoped if row.get("prompt_tokens") is None),
                "calls_unpriced": sum(1 for row in scoped if row.get("cost_usd") is None),
                "prompt_tokens": sum(_count(row, "prompt_tokens") for row in scoped),
                "completion_tokens": sum(_count(row, "completion_tokens") for row in scoped),
                "reasoning_tokens": sum(_count(row, "reasoning_tokens") for row in scoped),
                "cost_usd": _sum_costs(scoped),
            },
            # Busiest first, name as the tie-break so a refreshed page keeps its order.
            "by_purpose": sorted(
                grouped.values(),
                key=lambda entry: (-int(entry["calls"]), str(entry["purpose"])),
            ),
            "by_day": list(by_day.values()),
        }

    def prune_calls(self, retention_days: int) -> int:
        floor = self._now() - timedelta(days=retention_days)
        before = len(self.rows)
        self.rows = [row for row in self.rows if row["created_at"] >= floor]  # type: ignore[operator]
        return before - len(self.rows)


def _count(row: dict[str, object], field: str) -> int:
    value = row.get(field)
    return 0 if value is None else int(value)


def _optional_float(value: object) -> float | None:
    return None if value is None else float(value)


def _add(running: object, value: float | None) -> float | None:
    """Mirror `sum(cost_usd)`: nulls are skipped, and a column of nulls sums to null."""
    if value is None:
        return None if running is None else float(running)
    base = 0.0 if running is None else float(running)
    return round(base + value, 8)


def _sum_costs(rows: list[dict[str, object]]) -> float | None:
    costs = [row["cost_usd"] for row in rows if row.get("cost_usd") is not None]
    if not costs:
        return None
    return round(sum(float(cost) for cost in costs), 8)


class SupabaseLlmCallRepository:
    """The service-role surface: raw inserts, and one RPC for anything aggregate.

    Writes are fire-and-forget by contract - the caller swallows whatever this raises (see
    app/services/llm_usage.py), so nothing here is worth a user's answer.
    """

    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
            "Content-Type": "application/json",
        }

    def record_call(self, row: LlmCallRow) -> None:
        # `return=minimal`: the ledger row's id is never read back, and asking PostgREST to
        # represent it costs a second serialization on the hot path of every answer.
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/llm_calls",
            headers={**self._headers, "Prefer": "return=minimal"},
            json=row.as_row(),
        )
        response.raise_for_status()

    def summary(self, user_id: str, days: int) -> dict[str, object]:
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/rpc/llm_usage_summary",
            headers=self._headers,
            json={"p_user_id": user_id, "p_days": days},
        )
        response.raise_for_status()
        return dict(response.json())


llm_call_repository = InMemoryLlmCallRepository()
