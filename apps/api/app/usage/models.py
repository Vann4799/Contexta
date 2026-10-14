"""What one LLM call cost, and which user it cost it for.

The provider's own `usage` block is the only honest token count available here: there is no
tokenizer in this service, and the character heuristic the estimate used is off by a large
factor at the small end (measured: 6 words of prompt came back as 91 prompt tokens).

Nothing in here estimates a token count. Where the provider reported nothing, the field stays
null and the aggregate says so.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal, Mapping

from pydantic import BaseModel

from app.core.config import Settings

# `embeddings` has no writer yet: the embedding clients live in packages/rag behind a protocol
# shared with the worker, return only vectors, and carry no user identity, so recording them is
# a protocol change rather than a wiring change. The column accepts it today so that the moment
# that surface exists - and a gateway that settles money per call, like OpenRouter's `cost`
# field - the write needs no migration.
LlmPurpose = Literal["chat", "brief", "rewrite", "embeddings"]
LLM_PURPOSES: tuple[str, ...] = ("chat", "brief", "rewrite", "embeddings")

# 'prices' means this service multiplied reported tokens by a configured price; 'provider' means
# the gateway stated the money itself. A cost figure that does not say which is a guess wearing
# a decimal point.
CostBasis = Literal["prices", "provider"]

TOKENS_PER_MILLION = 1_000_000

UsageSink = Callable[["TokenUsage"], None]


@dataclass(frozen=True)
class TokenUsage:
    """What the provider reported about one completion.

    A None is a field the provider did not report, never a zero: writing 0 for an absent count
    would make the call look free in every aggregate built on these columns.
    """

    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    reasoning_tokens: int | None = None
    provider_cost_usd: float | None = None


def _reported_count(container: Mapping[str, object], key: str) -> int | None:
    value = container.get(key)
    # bool is an int in Python, and a JSON `true` sitting in a token field is a gateway saying
    # something that is not a count.
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        return None
    return value


def _reported_money(container: Mapping[str, object], key: str) -> float | None:
    value = container.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        return None
    return float(value)


def parse_llm_usage(body: Mapping[str, object], model: str) -> TokenUsage:
    """Read the `usage` block of an OpenAI-shaped completion response.

    `model` is the id this client asked for (already normalized by the caller), not the
    gateway's echo of it: prices are keyed on what was requested, and a gateway that answers
    with a different id would otherwise silently reprice the call.
    """
    usage = body.get("usage")
    if not isinstance(usage, Mapping):
        # The call happened and cost money even when the gateway withholds the block, so it is
        # still recorded - with nulls - instead of being dropped or guessed.
        return TokenUsage(model=model)

    details = usage.get("completion_tokens_details")
    details = details if isinstance(details, Mapping) else {}
    return TokenUsage(
        model=model,
        prompt_tokens=_reported_count(usage, "prompt_tokens"),
        completion_tokens=_reported_count(usage, "completion_tokens"),
        # Absent on a non-thinking model, which is not the same claim as "zero thought".
        reasoning_tokens=_reported_count(details, "reasoning_tokens"),
        # Only some gateways (OpenRouter among them) settle a price per call; DeepSeek does not,
        # so this is null on the path that serves every user today.
        provider_cost_usd=_reported_money(usage, "cost"),
    )


@dataclass(frozen=True)
class LlmCallRow:
    """One row of the cost ledger, as the repository writes it."""

    user_id: str
    purpose: LlmPurpose
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None
    reasoning_tokens: int | None
    cost_usd: float | None
    cost_basis: CostBasis | None

    def as_row(self) -> dict[str, object]:
        return {
            "user_id": self.user_id,
            "purpose": self.purpose,
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "reasoning_tokens": self.reasoning_tokens,
            "cost_usd": self.cost_usd,
            "cost_basis": self.cost_basis,
        }


def price_pair_per_million(model: str, settings: Settings) -> tuple[float, float] | None:
    """The configured (input, output) pair for one model, or None when it is unpriced.

    Half a price is not a price: a model with an input rate and no output rate would bill every
    completion as free, which is the same failure as no entry at all.
    """
    input_price = settings.llm_price_input_per_million.get(model)
    output_price = settings.llm_price_output_per_million.get(model)
    if input_price is None or output_price is None:
        return None
    if input_price <= 0 or output_price <= 0:
        return None
    return input_price, output_price


def cost_for_call(usage: TokenUsage, settings: Settings) -> tuple[float | None, CostBasis | None]:
    """Return (cost_usd, basis). Both are None when the cost genuinely is not known.

    An unpriced model yields null rather than a plausible-looking number, so a report built on
    these rows can tell the founder which calls were never costed.
    """
    if usage.provider_cost_usd is not None:
        return round(usage.provider_cost_usd, 8), "provider"

    if usage.prompt_tokens is None or usage.completion_tokens is None:
        return None, None
    prices = price_pair_per_million(usage.model, settings)
    if prices is None:
        return None, None

    # Reasoning tokens are never added here. DeepSeek bills them inside completion_tokens
    # (measured on a live call: completion_tokens 11, of which reasoning_tokens 8), so a second
    # term would charge every thinking model twice for the same tokens.
    input_price, output_price = prices
    cost = (
        usage.prompt_tokens * input_price + usage.completion_tokens * output_price
    ) / TOKENS_PER_MILLION
    return round(cost, 8), "prices"


class LlmUsageTotals(BaseModel):
    calls: int
    # Coverage counters: how much of the ledger is actually measured. `calls_without_tokens` is
    # what a provider that withheld its usage block produced; `calls_unpriced` is what a model
    # with no configured price produced. Summing `cost_usd` without these two in view is how an
    # estimate starts looking like a bill.
    calls_without_tokens: int
    calls_unpriced: int
    prompt_tokens: int
    completion_tokens: int
    reasoning_tokens: int
    cost_usd: float | None


class LlmPurposeUsage(BaseModel):
    purpose: str
    calls: int
    prompt_tokens: int
    completion_tokens: int
    reasoning_tokens: int
    cost_usd: float | None


class LlmDayUsage(BaseModel):
    date: str
    calls: int
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float | None


class LlmUsageSummaryResponse(BaseModel):
    days: int
    totals: LlmUsageTotals
    by_purpose: list[LlmPurposeUsage]
    by_day: list[LlmDayUsage]
