from __future__ import annotations

import sys
from pathlib import Path
from typing import Protocol

import httpx

from app.chat.models import RetrievedContext

try:
    from contexta_rag.embeddings import DeterministicEmbeddingProvider
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import DeterministicEmbeddingProvider


class EmbeddingProvider(Protocol):
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


class QdrantRetriever:
    def __init__(
        self,
        qdrant_url: str,
        collection_name: str,
        embedding_provider: EmbeddingProvider,
        api_key: str = "",
        client: httpx.Client | None = None,
    ) -> None:
        self._qdrant_url = qdrant_url.rstrip("/")
        self._collection_name = collection_name
        self._embedding_provider = embedding_provider
        self._headers = {"api-key": api_key} if api_key else None
        self._client = client or httpx.Client(timeout=30)

    def retrieve(
        self,
        user_id: str,
        question: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
        doc_types: list[str] | None = None,
    ) -> list[RetrievedContext]:
        query_vector = self._embedding_provider.embed_texts([question])[0]
        must_filters: list[dict[str, object]] = [
            {"key": "user_id", "match": {"value": user_id}}
        ]
        if document_ids:
            must_filters.append(
                {"key": "document_id", "match": {"any": document_ids}}
            )
        if doc_types:
            must_filters.append({"key": "doc_type", "match": {"any": doc_types}})

        response = self._client.post(
            f"{self._qdrant_url}/collections/{self._collection_name}/points/search",
            headers=self._headers,
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
                "doc_type": point["payload"].get("doc_type", "unclassified"),
                "chunk_index": point["payload"]["chunk_index"],
                "page_number": point["payload"].get("page_number"),
                "section_path": point["payload"].get("section_path"),
                "text": point["payload"]["text"],
                "score": point["score"],
            }
            for point in points
        ]
