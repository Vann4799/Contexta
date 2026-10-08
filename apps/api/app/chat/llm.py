from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)

# Ceiling for the one wider retry below. Without it a model that reasons its way to
# empty content every time would be asked for ever larger budgets.
RETRY_TOKEN_CAP = 8000

try:
    from contexta_rag.prompts import ConversationTurn, build_query_rewrite_prompt
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.prompts import ConversationTurn, build_query_rewrite_prompt


class AnswerGenerator(Protocol):
    def generate_answer(self, prompt: str) -> str:
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
    ) -> None:
        self._api_key = api_key
        self._model = model.strip().lower()
        self._base_url = base_url.rstrip("/")
        self._max_tokens = max_tokens
        self._thinking = thinking
        self._client = client or httpx.Client(timeout=60)

    def generate_answer(self, prompt: str) -> str:
        if not self._api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")

        content, finish_reason, reasoning_tokens = self._complete(prompt, self._max_tokens)

        if not content and finish_reason == "length" and self._max_tokens < RETRY_TOKEN_CAP:
            wider = min(self._max_tokens * 2, RETRY_TOKEN_CAP)
            logger.warning(
                "DeepSeek spent all %s tokens on reasoning (%s thinking, no answer); retrying at %s",
                self._max_tokens,
                reasoning_tokens,
                wider,
            )
            content, finish_reason, reasoning_tokens = self._complete(prompt, wider)

        if not content:
            logger.error(
                "DeepSeek returned no answer content (finish_reason=%s reasoning_tokens=%s)",
                finish_reason,
                reasoning_tokens,
            )
            raise RuntimeError("DeepSeek returned an empty answer.")

        if finish_reason == "length":
            # The answer is real but cut off; the caller deserves to know it may end mid-sentence.
            logger.warning("DeepSeek answer was truncated at the token budget.")
        return content

    def _complete(self, prompt: str, max_tokens: int) -> tuple[str, str | None, int]:
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
        details = (body.get("usage") or {}).get("completion_tokens_details") or {}
        content = (message.get("content") or "").strip()
        return content, choice.get("finish_reason"), int(details.get("reasoning_tokens") or 0)


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
    ) -> None:
        self._api_key = api_key
        self._model = model.strip().lower()
        self._base_url = base_url.rstrip("/")
        self._max_tokens = max_tokens
        self._client = client or httpx.Client(timeout=20)

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
        content = response.json()["choices"][0]["message"].get("content") or ""
        return content.strip() or None
