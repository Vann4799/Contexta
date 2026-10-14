from __future__ import annotations

import logging
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx

from app.usage.models import TokenUsage, UsageSink, parse_llm_usage

logger = logging.getLogger(__name__)

# Ceiling for the one wider retry below. Without it a model that reasons its way to
# empty content every time would be asked for ever larger budgets.
RETRY_TOKEN_CAP = 8000

# The web client aborts a chat request after 120s, so a generation may not quietly
# consume two full attempt timeouts: a retry is only fired while the first attempt
# has left enough of that window for another one.
RETRY_TIME_BUDGET_SECONDS = 100.0
RETRY_ATTEMPT_TIMEOUT_SECONDS = 60.0


@dataclass(frozen=True)
class AnswerResult:
    """The answer plus whether it hit the token budget (finish_reason=length)."""

    content: str
    truncated: bool = False

try:
    from contexta_rag.prompts import ConversationTurn, build_query_rewrite_prompt
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.prompts import ConversationTurn, build_query_rewrite_prompt


class AnswerGenerator(Protocol):
    def generate_answer(self, prompt: str) -> AnswerResult:
        ...


class QueryRewriter(Protocol):
    def rewrite_query(self, question: str, history: list[ConversationTurn]) -> str | None:
        ...


class DeepSeekAnswerGenerator:
    """Answers a RAG prompt, minding that reasoning shares the answer's budget.

    DeepSeek bills thinking tokens inside `max_tokens`, so a long chain of thought can
    spend the whole budget and return `content: ""` with `finish_reason: "length"`. That
    is not a model failure - the answer exists one retry wider - and treating it as one
    turned real answers into a 502.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "deepseek-chat",
        base_url: str = "https://api.deepseek.com",
        max_tokens: int = 900,
        thinking: bool = True,
        client: httpx.Client | None = None,
        on_usage: UsageSink | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model.strip().lower()
        self._base_url = base_url.rstrip("/")
        self._max_tokens = max_tokens
        self._thinking = thinking
        self._client = client or httpx.Client(timeout=60)
        self._on_usage = on_usage

    def attach_usage_sink(self, sink: UsageSink) -> None:
        """Bind the cost ledger after construction, by whoever knows which user is billed.

        Built here rather than in the constructor because the same client class serves chat,
        briefs and the eval harness, and only the route layer knows the user. Eval runs leave
        it unattached, which loses a ledger row and nothing else.
        """
        self._on_usage = sink

    def generate_answer(self, prompt: str) -> AnswerResult:
        if not self._api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")

        started = time.monotonic()
        content, finish_reason, usage = self._complete(prompt, self._max_tokens)
        elapsed = time.monotonic() - started

        if not content and finish_reason == "length" and self._max_tokens < RETRY_TOKEN_CAP:
            if elapsed + RETRY_ATTEMPT_TIMEOUT_SECONDS <= RETRY_TIME_BUDGET_SECONDS:
                wider = min(self._max_tokens * 2, RETRY_TOKEN_CAP)
                logger.warning(
                    "DeepSeek spent all %s tokens on reasoning (%s thinking, no answer); retrying at %s",
                    self._max_tokens,
                    usage.reasoning_tokens,
                    wider,
                )
                content, finish_reason, usage = self._complete(prompt, wider)
            else:
                logger.warning(
                    "DeepSeek spent all %s tokens on reasoning and %.1fs of wall clock; "
                    "skipping the wider retry because another attempt could outlast the client",
                    self._max_tokens,
                    elapsed,
                )

        if not content:
            logger.error(
                "DeepSeek returned no answer content (finish_reason=%s reasoning_tokens=%s)",
                finish_reason,
                usage.reasoning_tokens,
            )
            raise RuntimeError("DeepSeek returned an empty answer.")

        if finish_reason == "length":
            # The answer is real but cut off; the flag tells the caller to say it may end
            # mid-sentence instead of presenting it as complete.
            logger.warning("DeepSeek answer was truncated at the token budget.")
        return AnswerResult(content=content, truncated=finish_reason == "length")

    def _complete(self, prompt: str, max_tokens: int) -> tuple[str, str | None, TokenUsage]:
        response = self._client.post(
            f"{self._base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                "temperature": 0.1,
                "max_tokens": max_tokens,
                # Both deepseek-chat and deepseek-v4-pro think unless told not to.
                "thinking": {"type": "enabled" if self._thinking else "disabled"},
            },
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = response.text[:500]
            raise RuntimeError(f"DeepSeek API error {response.status_code}: {detail}") from exc
        body = response.json()
        choice = body["choices"][0]
        message = choice["message"]
        # Recorded per attempt, not per answer: the wider retry above is a second billed
        # completion, and a ledger that only counts the survivor would understate cost.
        usage = parse_llm_usage(body, model=self._model)
        if self._on_usage is not None:
            self._on_usage(usage)
        content = (message.get("content") or "").strip()
        return content, choice.get("finish_reason"), usage


class DeepSeekQueryRewriter:
    """Rewrites a follow-up into one standalone search query.

    Kept separate from the answer generator on purpose: this output is a lookup
    key, so it wants few tokens, no reasoning, and no prose to explain itself.
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str = "https://api.deepseek.com",
        max_tokens: int = 160,
        client: httpx.Client | None = None,
        on_usage: UsageSink | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model.strip().lower()
        self._base_url = base_url.rstrip("/")
        self._max_tokens = max_tokens
        self._client = client or httpx.Client(timeout=20)
        self._on_usage = on_usage

    def attach_usage_sink(self, sink: UsageSink) -> None:
        """See DeepSeekAnswerGenerator.attach_usage_sink: same binding, same reason."""
        self._on_usage = sink

    def rewrite_query(self, question: str, history: list[ConversationTurn]) -> str | None:
        if not self._api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")

        response = self._client.post(
            f"{self._base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
                "messages": [
                    {"role": "user", "content": build_query_rewrite_prompt(question, history)}
                ],
                "temperature": 0,
                "max_tokens": self._max_tokens,
            },
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = response.text[:300]
            raise RuntimeError(f"DeepSeek rewrite error {response.status_code}: {detail}") from exc
        body = response.json()
        # A rewrite is the cheapest call in the product and the easiest to forget: at 1000
        # questions a day it is its own line item in the per-user cost.
        usage = parse_llm_usage(body, model=self._model)
        if self._on_usage is not None:
            self._on_usage(usage)
        content = body["choices"][0]["message"].get("content") or ""
        return content.strip() or None
