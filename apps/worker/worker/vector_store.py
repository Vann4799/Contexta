from __future__ import annotations

import sys
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import httpx

from worker.processor import ProcessingChunk, ProcessingDocument

try:
    from contexta_rag.embeddings import DeterministicEmbeddingProvider
    from contexta_rag.vector_space import VectorSpace, assert_vector_spaces_match
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[3] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import DeterministicEmbeddingProvider
    from contexta_rag.vector_space import VectorSpace, assert_vector_spaces_match

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
        vectors: list[VectorSpace],
        api_key: str = "",
        client: httpx.Client | None = None,
        index_metadata: dict[str, object] | None = None,
    ) -> None:
        if not vectors:
            raise ValueError("at least one vector space is required")
        self._qdrant_url = qdrant_url.rstrip("/")
        self._collection_name = collection_name
        self._vectors = vectors
        self._headers = {"api-key": api_key} if api_key else None
        self._client = client or httpx.Client(timeout=30)
        self._index_metadata = dict(index_metadata or {})
        self._collection_checked = False

    def upsert_chunks(
        self,
        document: ProcessingDocument,
        chunks: list[ProcessingChunk],
        embeddings: dict[str, list[list[float]]],
    ) -> list[str]:
        missing = [space.name for space in self._vectors if space.name not in embeddings]
        if missing:
            raise ValueError(
                f"no embeddings supplied for vector slot(s): {', '.join(missing)}"
            )
        self._ensure_collection()
        doc_type = document.get("doc_type") or "unclassified"
        doc_version = document.get("doc_version")
        point_ids = [self._point_id(chunk) for chunk in chunks]
        points = [
            {
                "id": point_id,
                "vector": self._vector_for(index, embeddings),
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
            for point_id, chunk, index in zip(point_ids, chunks, range(len(chunks)))
        ]

        response = self._client.put(
            f"{self._qdrant_url}/collections/{self._collection_name}/points",
            headers=self._headers,
            json={"points": points},
        )
        response.raise_for_status()
        return point_ids

    def _vector_for(
        self,
        index: int,
        embeddings: dict[str, list[list[float]]],
    ) -> object:
        if len(self._vectors) == 1 and not self._vectors[0].name:
            return embeddings[""][index]
        return {space.name: embeddings[space.name][index] for space in self._vectors}

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

        if not assert_vector_spaces_match(
            client=self._client,
            qdrant_url=self._qdrant_url,
            collection_name=self._collection_name,
            spaces=self._vectors,
            headers=self._headers,
        ):
            create_response = self._client.put(
                f"{self._qdrant_url}/collections/{self._collection_name}",
                headers=self._headers,
                json={"vectors": self._collection_vector_config()},
            )
            create_response.raise_for_status()

        self._ensure_payload_indexes()
        self._collection_checked = True

    def _collection_vector_config(self) -> dict[str, object]:
        """One unnamed vector keeps the flat Qdrant shape; several need names."""
        if len(self._vectors) == 1 and not self._vectors[0].name:
            return {
                "size": self._vectors[0].dimensions,
                "distance": "Cosine",
            }
        return {
            space.name: {"size": space.dimensions, "distance": "Cosine"}
            for space in self._vectors
        }

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
