from __future__ import annotations

import json

import httpx
import pytest

from app.chat.llm import RETRY_TOKEN_CAP, DeepSeekAnswerGenerator


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

    assert generator.generate_answer("hello").content == "ok"
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


def _reasoning_ate_the_budget(reasoning_tokens: int = 900) -> dict[str, object]:
    """The shape DeepSeek returns when thinking spends the whole max_tokens budget."""
    return {
        "choices": [
            {
                "message": {"content": "", "reasoning_content": "thinking out loud"},
                "finish_reason": "length",
            }
        ],
        "usage": {"completion_tokens_details": {"reasoning_tokens": reasoning_tokens}},
    }


def _answered(content: str, finish_reason: str = "stop") -> dict[str, object]:
    return {
        "choices": [{"message": {"content": content}, "finish_reason": finish_reason}],
    }


def test_reasoning_that_ate_the_budget_retries_once_wider() -> None:
    budgets: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        budget = json.loads(request.content)["max_tokens"]
        budgets.append(budget)
        if budget == 900:
            return httpx.Response(200, json=_reasoning_ate_the_budget())
        return httpx.Response(200, json=_answered("grounded answer"))

    generator = DeepSeekAnswerGenerator(
        api_key="test-key",
        model="deepseek-v4-pro",
        max_tokens=900,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    result = generator.generate_answer("hello")

    assert result.content == "grounded answer"
    assert result.truncated is False
    assert budgets == [900, 1800]


def test_answer_that_never_arrives_raises_after_one_retry() -> None:
    budgets: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        budgets.append(json.loads(request.content)["max_tokens"])
        return httpx.Response(200, json=_reasoning_ate_the_budget())

    generator = DeepSeekAnswerGenerator(
        api_key="test-key",
        model="deepseek-v4-pro",
        max_tokens=900,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(RuntimeError, match="empty answer"):
        generator.generate_answer("hello")
    assert budgets == [900, 1800]


def test_budget_already_at_the_cap_is_not_widened() -> None:
    budgets: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        budgets.append(json.loads(request.content)["max_tokens"])
        return httpx.Response(200, json=_reasoning_ate_the_budget())

    generator = DeepSeekAnswerGenerator(
        api_key="test-key",
        model="deepseek-v4-pro",
        max_tokens=RETRY_TOKEN_CAP,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(RuntimeError, match="empty answer"):
        generator.generate_answer("hello")
    assert budgets == [RETRY_TOKEN_CAP]


@pytest.mark.parametrize(("thinking", "wire"), [(True, "enabled"), (False, "disabled")])
def test_thinking_flag_reaches_the_request(thinking: bool, wire: str) -> None:
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_payload.update(json.loads(request.content))
        return httpx.Response(200, json=_answered("ok"))

    generator = DeepSeekAnswerGenerator(
        api_key="test-key",
        model="deepseek-v4-pro",
        thinking=thinking,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert generator.generate_answer("hello").content == "ok"
    assert captured_payload["thinking"] == {"type": wire}


def test_truncated_answer_is_returned_instead_of_raising() -> None:
    budgets: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        budgets.append(json.loads(request.content)["max_tokens"])
        return httpx.Response(200, json=_answered("answer cut mid-sent", finish_reason="length"))

    generator = DeepSeekAnswerGenerator(
        api_key="test-key",
        model="deepseek-v4-pro",
        max_tokens=900,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    result = generator.generate_answer("hello")

    assert result.content == "answer cut mid-sent"
    assert result.truncated is True
    assert budgets == [900]


class _SteppedClock:
    """A clock whose every reading jumps, so the first attempt looks slow."""

    def __init__(self, step_seconds: float) -> None:
        self._now = 0.0
        self._step = step_seconds

    def monotonic(self) -> float:
        self._now += self._step
        return self._now


def test_wide_retry_is_skipped_when_the_wall_clock_is_spent(monkeypatch: pytest.MonkeyPatch) -> None:
    budgets: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        budgets.append(json.loads(request.content)["max_tokens"])
        return httpx.Response(200, json=_reasoning_ate_the_budget())

    generator = DeepSeekAnswerGenerator(
        api_key="test-key",
        model="deepseek-v4-pro",
        max_tokens=900,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    monkeypatch.setattr("app.chat.llm.time", _SteppedClock(61.0))

    with pytest.raises(RuntimeError, match="empty answer"):
        generator.generate_answer("hello")

    assert budgets == [900]
