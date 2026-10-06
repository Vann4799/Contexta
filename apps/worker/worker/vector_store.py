from __future__ import annotations

import sys
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import httpx

from worker.processor import ProcessingChunk, ProcessingDocument

try:
    from contexta_rag.embeddings import DeterministicEmbeddingProvider
    from contexta_rag.vector_space import assert_vector_space_matches
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[3] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import DeterministicEmbeddingProvider
    from contexta_rag.vector_space import assert_vector_space_matches

_PAYLOAD_INDEXES = (
    ("user_id", "keyword"),
    ("document_id", "keyword"),
    ("doc_type", "keyword"),
    ("page_number", "integer"),
)


class QdrantVectorStore:
    def __init__(
        self,
        qdrant_url: str,
        collection_name: str,
        dimensions: int,
        api_key: str = "",
        client: httpx.Client | None = None,
        index_metadata: dict[str, object] | None = None,
    ) -> None:
        self._qdrant_url = qdrant_url.rstrip("/")
        self._collection_name = collection_name
        self._dimensions = dimensions
        self._headers = {"api-key": api_key} if api_key else None
        self._client = client or httpx.Client(timeout=30)
        self._index_metadata = dict(index_metadata or {})
        self._collection_checked = False

    def upsert_chunks(
        self,
        document: ProcessingDocument,
        chunks: list[ProcessingChunk],
        embeddings: list[list[float]],
    ) -> list[str]:
        self._ensure_collection()
        doc_type = document.get("doc_type") or "unclassified"
        doc_version = document.get("doc_version")
        point_ids = [self._point_id(chunk) for chunk in chunks]
        points = [
            {
                "id": point_id,
                "vector": embedding,
                "payload": {
                    **self._index_metadata,
                    "document_id": chunk["document_id"],
                    "user_id": chunk["user_id"],
                    "filename": document.get("filename", ""),
                    "doc_type": doc_type,
                    "doc_version": doc_version,
                    "chunk_index": chunk["chunk_index"],
                    "text": chunk["text"],
                    "page_number": chunk["page_number"],
                    "section_path": chunk["section_path"],
                    "is_table": chunk["is_table"],
                },
            }
            for point_id, chunk, embedding in zip(point_ids, chunks, embeddings)
        ]

        response = self._client.put(
            f"{self._qdrant_url}/collections/{self._collection_name}/points",
            headers=self._headers,
            json={"points": points},
        )
        response.raise_for_status()
        return point_ids

    def _point_id(self, chunk: ProcessingChunk) -> str:
        return str(
            uuid5(
                NAMESPACE_URL,
                f"contexta:{chunk['document_id']}:{chunk['chunk_index']}",
            )
        )

    def prune_stale_chunks(self, document_id: str, chunk_count: int) -> None:
        """Drop points left over from a longer chunking of the same document."""
        if chunk_count <= 0:
            return

        response = self._client.post(
            f"{self._qdrant_url}/collections/{self._collection_name}/points/delete",
            headers=self._headers,
            params={"wait": "true"},
            json={
                "filter": {
                    "must": [
                        {"key": "document_id", "match": {"value": document_id}},
                        {"key": "chunk_index", "range": {"gte": chunk_count}},
                    ]
                }
            },
        )
        response.raise_for_status()

    def _ensure_collection(self) -> None:
        if self._collection_checked:
            return

        if not assert_vector_space_matches(
            client=self._client,
            qdrant_url=self._qdrant_url,
            collection_name=self._collection_name,
            dimensions=self._dimensions,
            model_label=str(self._index_metadata.get("embedding_model") or ""),
            headers=self._headers,
        ):
            create_response = self._client.put(
                f"{self._qdrant_url}/collections/{self._collection_name}",
                headers=self._headers,
                json={
                    "vectors": {
                        "size": self._dimensions,
                        "distance": "Cosine",
                    }
                },
            )
            create_response.raise_for_status()

        self._ensure_payload_indexes()
        self._collection_checked = True

    def _ensure_payload_indexes(self) -> None:
        for field_name, field_type in _PAYLOAD_INDEXES:
            index_response = self._client.put(
                f"{self._qdrant_url}/collections/{self._collection_name}/index",
                headers=self._headers,
                params={"wait": "true"},
                json={
                    "field_name": field_name,
                    "field_schema": {"type": field_type},
                },
            )
            index_response.raise_for_status()
