import pytest

from contexta_rag.embeddings import (
    DeterministicEmbeddingProvider,
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
