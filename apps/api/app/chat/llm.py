from __future__ import annotations

from typing import Protocol

import httpx


class AnswerGenerator(Protocol):
    def generate_answer(self, prompt: str) -> str:
        ...


class DeepSeekAnswerGenerator:
    def __init__(
        self,
        api_key: str,
        model: str = "deepseek-chat",
        base_url: str = "https://api.deepseek.com",
        client: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
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
            },
        )
        response.raise_for_status()
        body = response.json()
        return body["choices"][0]["message"]["content"]
