from __future__ import annotations

import hashlib
import math
from typing import Protocol

import httpx

from app.chat.models import RetrievedContext


class EmbeddingProvider(Protocol):
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


class DeterministicEmbeddingProvider:
    def __init__(self, dimensions: int = 384) -> None:
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


class QdrantRetriever:
    def __init__(
        self,
        qdrant_url: str,
        collection_name: str,
        embedding_provider: EmbeddingProvider,
        client: httpx.Client | None = None,
    ) -> None:
        self._qdrant_url = qdrant_url.rstrip("/")
        self._collection_name = collection_name
        self._embedding_provider = embedding_provider
        self._client = client or httpx.Client(timeout=30)

    def retrieve(
        self,
        user_id: str,
        question: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[RetrievedContext]:
        query_vector = self._embedding_provider.embed_texts([question])[0]
        must_filters: list[dict[str, object]] = [
            {"key": "user_id", "match": {"value": user_id}}
        ]
        if document_ids:
            must_filters.append(
                {"key": "document_id", "match": {"any": document_ids}}
            )

        response = self._client.post(
            f"{self._qdrant_url}/collections/{self._collection_name}/points/search",
            json={
                "vector": query_vector,
                "limit": top_k,
                "with_payload": True,
                "filter": {"must": must_filters},
            },
        )
        response.raise_for_status()
        points = response.json().get("result", [])
        return [
            {
                "document_id": point["payload"]["document_id"],
                "document_name": point["payload"].get("filename", "Unknown document"),
                "chunk_index": point["payload"]["chunk_index"],
                "page_number": point["payload"].get("page_number"),
                "text": point["payload"]["text"],
                "score": point["score"],
            }
            for point in points
        ]
