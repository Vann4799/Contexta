from __future__ import annotations

import hashlib
import math
import time
from collections.abc import Callable
from typing import Protocol


class EmbeddingProvider(Protocol):
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


class DeterministicEmbeddingProvider:
    def __init__(self, dimensions: int = 384) -> None:
        if dimensions <= 0:
            raise ValueError("dimensions must be greater than 0")
        self.dimensions = dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_text(text) for text in texts]

    def _embed_text(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        for word in text.lower().split():
            digest = hashlib.sha256(word.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        magnitude = math.sqrt(sum(value * value for value in vector))
        if magnitude == 0:
            return vector
        return [value / magnitude for value in vector]


class RemoteEmbeddingProvider:
    """Calls an embedding service over HTTP so only one process holds the model."""

    def __init__(
        self,
        base_url: str,
        dimensions: int = 0,
        timeout_seconds: float = 60.0,
        max_attempts: int = 3,
    ) -> None:
        if not base_url.strip():
            raise ValueError("base_url is required for the remote embedding provider")
        self._endpoint = base_url.rstrip("/") + "/embed"
        self._dimensions = dimensions
        self._timeout_seconds = timeout_seconds
        self._max_attempts = max(1, max_attempts)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        vectors = self._post(texts)
        if len(vectors) != len(texts):
            raise ValueError(
                f"embedding service returned {len(vectors)} vectors for {len(texts)} texts"
            )
        for vector in vectors:
            if self._dimensions and len(vector) != self._dimensions:
                raise ValueError(
                    f"embedding service returned {len(vector)} dimensions, "
                    f"expected {self._dimensions}"
                )
        return [[float(value) for value in vector] for vector in vectors]

    def _post(self, texts: list[str]) -> list[list[float]]:
        try:
            import httpx
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "httpx is not installed. Install it before using a remote embedding service."
            ) from exc

        last_error: Exception | None = None
        for attempt in range(self._max_attempts):
            try:
                response = httpx.post(
                    self._endpoint,
                    json={"texts": list(texts)},
                    timeout=self._timeout_seconds,
                )
                if response.status_code < 500:
                    response.raise_for_status()
                    return list(response.json()["vectors"])
                last_error = RuntimeError(
                    f"embedding service returned HTTP {response.status_code}"
                )
            except httpx.HTTPError as exc:
                last_error = exc

            if attempt + 1 < self._max_attempts:
                time.sleep(0.5 * 2**attempt)

        raise RuntimeError(f"embedding service unavailable: {last_error}")


class SentenceTransformerEmbeddingProvider:
    def __init__(
        self,
        model_name: str = "BAAI/bge-m3",
        device: str | None = None,
        normalize_embeddings: bool = True,
        model: object | None = None,
        model_loader: Callable[[str], object] | None = None,
    ) -> None:
        self._normalize_embeddings = normalize_embeddings
        self._model = model or self._load_model(model_name, device, model_loader)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        encoded = self._model.encode(
            texts,
            normalize_embeddings=self._normalize_embeddings,
            show_progress_bar=False,
        )
        return [[float(value) for value in vector] for vector in encoded]

    def _load_model(
        self,
        model_name: str,
        device: str | None,
        model_loader: Callable[[str], object] | None,
    ) -> object:
        try:
            if model_loader:
                sentence_transformers = model_loader("sentence_transformers")
                sentence_transformer = sentence_transformers.SentenceTransformer
            else:
                from sentence_transformers import SentenceTransformer

                sentence_transformer = SentenceTransformer
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "sentence-transformers is not installed. Install it before using local embeddings."
            ) from exc

        kwargs = {"device": device} if device else {}
        return sentence_transformer(model_name, **kwargs)


def create_embedding_provider(
    provider_name: str = "deterministic",
    dimensions: int = 384,
    model_name: str = "BAAI/bge-m3",
    device: str | None = None,
    remote_url: str = "",
    model_loader: Callable[[str], object] | None = None,
) -> EmbeddingProvider:
    normalized_name = provider_name.strip().lower()
    resolved_device = None if not device or device.lower() == "auto" else device
    if normalized_name in {"deterministic", "hash"}:
        return DeterministicEmbeddingProvider(dimensions=dimensions)
    if normalized_name in {"sentence-transformers", "sentence_transformers", "local"}:
        return SentenceTransformerEmbeddingProvider(
            model_name=model_name,
            device=resolved_device,
            model_loader=model_loader,
        )
    if normalized_name in {"remote", "service", "http"}:
        if not remote_url.strip():
            raise ValueError(
                "EMBEDDING_PROVIDER=remote requires EMBEDDING_REMOTE_URL "
                "(a word-hash fallback would quietly degrade retrieval)"
            )
        return RemoteEmbeddingProvider(base_url=remote_url, dimensions=dimensions)
    if normalized_name == "auto":
        if remote_url.strip():
            return RemoteEmbeddingProvider(base_url=remote_url, dimensions=dimensions)
        try:
            return SentenceTransformerEmbeddingProvider(
                model_name=model_name,
                device=resolved_device,
                model_loader=model_loader,
            )
        except RuntimeError:
            return DeterministicEmbeddingProvider(dimensions=dimensions)

    raise ValueError(f"Unknown embedding provider: {provider_name}")
