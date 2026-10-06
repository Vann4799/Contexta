import httpx
import pytest

from contexta_rag.embeddings import (
    DeterministicEmbeddingProvider,
    RemoteEmbeddingProvider,
    SentenceTransformerEmbeddingProvider,
    create_embedding_provider,
)


def test_deterministic_embedding_provider_returns_stable_normalized_vectors() -> None:
    provider = DeterministicEmbeddingProvider(dimensions=8)

    first = provider.embed_texts(["alpha beta"])[0]
    second = provider.embed_texts(["alpha beta"])[0]

    assert first == second
    assert len(first) == 8
    assert any(value != 0 for value in first)


def test_sentence_transformer_provider_uses_supplied_model() -> None:
    class FakeModel:
        def encode(self, texts, **kwargs):
            assert texts == ["hello", "world"]
            assert kwargs["normalize_embeddings"] is True
            assert kwargs["show_progress_bar"] is False
            return [[1, 2, 3], [4.5, 5.5, 6.5]]

    provider = SentenceTransformerEmbeddingProvider(model=FakeModel())

    assert provider.embed_texts(["hello", "world"]) == [
        [1.0, 2.0, 3.0],
        [4.5, 5.5, 6.5],
    ]


def test_sentence_transformer_provider_explains_missing_dependency(monkeypatch) -> None:
    def fail_import(name: str):
        raise ModuleNotFoundError(name)

    with pytest.raises(RuntimeError, match="sentence-transformers"):
        SentenceTransformerEmbeddingProvider(model_loader=fail_import)


def test_auto_embedding_provider_falls_back_to_deterministic_when_local_model_missing() -> None:
    def fail_import(name: str):
        raise ModuleNotFoundError(name)

    provider = create_embedding_provider(
        provider_name="auto",
        dimensions=12,
        model_loader=fail_import,
    )

    assert isinstance(provider, DeterministicEmbeddingProvider)
    assert len(provider.embed_texts(["fallback"])[0]) == 12


class FakeResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {}

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("POST", "http://embeddings:8070/embed")
            raise httpx.HTTPStatusError(
                "service error",
                request=request,
                response=httpx.Response(self.status_code, request=request),
            )

    def json(self) -> dict:
        return self._payload


@pytest.fixture(autouse=True)
def no_retry_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("contexta_rag.embeddings.time.sleep", lambda _seconds: None)


def test_remote_provider_posts_texts_to_the_embed_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict] = []

    def fake_post(url: str, json: dict, timeout: float) -> FakeResponse:
        calls.append({"url": url, "json": json, "timeout": timeout})
        return FakeResponse(200, {"vectors": [[1, 2], [3, 4]]})

    monkeypatch.setattr(httpx, "post", fake_post)
    provider = RemoteEmbeddingProvider(base_url="http://embeddings:8070/")

    assert provider.embed_texts(["alpha", "beta"]) == [
        [1.0, 2.0],
        [3.0, 4.0],
    ]
    assert calls == [
        {
            "url": "http://embeddings:8070/embed",
            "json": {"texts": ["alpha", "beta"]},
            "timeout": 60.0,
        }
    ]


def test_remote_provider_skips_the_request_for_no_texts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def never_post(*args: object, **kwargs: object) -> FakeResponse:
        raise AssertionError("an empty batch should not reach the service")

    monkeypatch.setattr(httpx, "post", never_post)

    assert RemoteEmbeddingProvider(base_url="http://embeddings:8070").embed_texts([]) == []


def test_remote_provider_rejects_a_wrong_dimension_count() -> None:
    class WrongDimensions:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"vectors": [[0.1, 0.2, 0.3]]}

    provider = RemoteEmbeddingProvider(base_url="http://x", dimensions=384)
    provider._post = lambda texts: WrongDimensions().json()["vectors"]  # type: ignore[method-assign]

    with pytest.raises(ValueError, match="expected 384"):
        provider.embed_texts(["alpha"])


def test_remote_provider_retries_a_failing_service_then_reports_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts: list[int] = []

    def flaky_post(*args: object, **kwargs: object) -> FakeResponse:
        attempts.append(len(attempts))
        return FakeResponse(503)

    monkeypatch.setattr(httpx, "post", flaky_post)
    provider = RemoteEmbeddingProvider(base_url="http://x", max_attempts=3)

    with pytest.raises(RuntimeError, match="embedding service unavailable"):
        provider.embed_texts(["alpha"])

    assert len(attempts) == 3


def test_remote_provider_requires_a_url_rather_than_falling_back_to_hashes() -> None:
    with pytest.raises(ValueError, match="EMBEDDING_REMOTE_URL"):
        create_embedding_provider(provider_name="remote", remote_url="")

    provider = create_embedding_provider(
        provider_name="remote", remote_url="http://embeddings:8070"
    )

    assert isinstance(provider, RemoteEmbeddingProvider)
