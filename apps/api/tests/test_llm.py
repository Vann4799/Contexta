from __future__ import annotations

import json

import httpx
import pytest

from app.chat.llm import DeepSeekAnswerGenerator


def test_deepseek_model_name_is_normalized_before_request() -> None:
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_payload.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "ok",
                        }
                    }
                ]
            },
        )

    generator = DeepSeekAnswerGenerator(
        api_key="test-key",
        model="DeepSeek-V4-Pro",
        max_tokens=512,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert generator.generate_answer("hello") == "ok"
    assert captured_payload["model"] == "deepseek-v4-pro"
    assert captured_payload["max_tokens"] == 512


def test_empty_deepseek_content_raises_clear_error() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "",
                            "reasoning_content": "thinking only",
                        }
                    }
                ]
            },
        )

    generator = DeepSeekAnswerGenerator(
        api_key="test-key",
        model="deepseek-v4-flash",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(RuntimeError, match="empty answer"):
        generator.generate_answer("hello")
