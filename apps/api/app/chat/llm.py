from __future__ import annotations

import sys
from pathlib import Path
from typing import Protocol

import httpx

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
    def __init__(
        self,
        api_key: str,
        model: str = "deepseek-chat",
        base_url: str = "https://api.deepseek.com",
        max_tokens: int = 900,
        client: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model.strip().lower()
        self._base_url = base_url.rstrip("/")
        self._max_tokens = max_tokens
        self._client = client or httpx.Client(timeout=60)

    def generate_answer(self, prompt: str) -> str:
        if not self._api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")

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
                "max_tokens": self._max_tokens,
            },
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = response.text[:500]
            raise RuntimeError(f"DeepSeek API error {response.status_code}: {detail}") from exc
        body = response.json()
        content = body["choices"][0]["message"].get("content") or ""
        if not content.strip():
            raise RuntimeError("DeepSeek returned an empty answer. Try a content-generating model such as deepseek-v4-pro.")
        return content


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
