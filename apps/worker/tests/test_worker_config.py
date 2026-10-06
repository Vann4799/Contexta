from __future__ import annotations

import pytest

from worker.main import ArmSettings, build_arms, read_arm_settings


def settings(name: str = "", provider: str = "deterministic") -> ArmSettings:
    return ArmSettings(
        name=name,
        provider=provider,
        model_name="miniLM",
        dimensions=384,
        device=None,
        remote_url="",
        base_url="",
        api_key="",
    )


def test_primary_arm_reads_the_unprefixed_env_and_secondary_is_optional(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EMBEDDING_PROVIDER", "remote")
    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "miniLM-l12")
    monkeypatch.setenv("EMBEDDING_DIMENSIONS", "384")
    monkeypatch.setenv("EMBEDDING_REMOTE_URL", "http://embeddings:8070/embed")

    primary = read_arm_settings("", "deterministic")
    assert primary is not None
    assert (primary.provider, primary.model_name, primary.remote_url) == (
        "remote",
        "miniLM-l12",
        "http://embeddings:8070/embed",
    )
    assert read_arm_settings("SECONDARY_", "") is None


def test_secondary_arm_gets_its_own_group(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECONDARY_EMBEDDING_PROVIDER", "openrouter")
    monkeypatch.setenv("SECONDARY_EMBEDDING_MODEL_NAME", "text-embedding-3-small")
    monkeypatch.setenv("SECONDARY_EMBEDDING_DIMENSIONS", "1536")
    monkeypatch.setenv("SECONDARY_EMBEDDING_API_KEY", "key-from-env")
    monkeypatch.setenv("SECONDARY_EMBEDDING_VECTOR_NAME", "openai")

    arm = read_arm_settings("SECONDARY_", "")

    assert arm is not None
    assert (arm.name, arm.provider, arm.dimensions) == ("openai", "openrouter", 1536)


def test_a_single_arm_keeps_the_unnamed_vector_slot() -> None:
    arms = build_arms([settings()])

    assert [arm.name for arm in arms] == [""]


def test_two_arms_must_name_their_vector_slots() -> None:
    with pytest.raises(ValueError, match="EMBEDDING_VECTOR_NAME"):
        build_arms([settings(), settings(provider="openrouter")])


def test_two_arms_need_distinct_vector_slots() -> None:
    with pytest.raises(ValueError, match="must be distinct"):
        build_arms([settings(name="shared"), settings(name="shared")])
