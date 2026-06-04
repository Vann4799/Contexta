from __future__ import annotations

import sys
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import httpx

from worker.processor import ProcessingChunk, ProcessingDocument

try:
    from contexta_rag.embeddings import DeterministicEmbeddingProvider
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[3] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import DeterministicEmbeddingProvider


class QdrantVectorStore:
    def __init__(
        self,
        qdrant_url: str,
        collection_name: str,
        dimensions: int,
        client: httpx.Client | None = None,
    ) -> None:
        self._qdrant_url = qdrant_url.rstrip("/")
        self._collection_name = collection_name
        self._dimensions = dimensions
        self._client = client or httpx.Client(timeout=30)
        self._collection_checked = False

    def upsert_chunks(
        self,
        document: ProcessingDocument,
        chunks: list[ProcessingChunk],
        embeddings: list[list[float]],
    ) -> list[str]:
        self._ensure_collection()
        point_ids = [self._point_id(chunk) for chunk in chunks]
        points = [
            {
                "id": point_id,
                "vector": embedding,
                "payload": {
                    "document_id": chunk["document_id"],
                    "user_id": chunk["user_id"],
                    "filename": document.get("filename", ""),
                    "chunk_index": chunk["chunk_index"],
                    "text": chunk["text"],
                    "page_number": chunk["page_number"],
                },
            }
            for point_id, chunk, embedding in zip(point_ids, chunks, embeddings)
        ]

        response = self._client.put(
            f"{self._qdrant_url}/collections/{self._collection_name}/points",
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

    def _ensure_collection(self) -> None:
        if self._collection_checked:
            return

        response = self._client.get(
            f"{self._qdrant_url}/collections/{self._collection_name}"
        )
        if response.status_code == 404:
            create_response = self._client.put(
                f"{self._qdrant_url}/collections/{self._collection_name}",
                json={
                    "vectors": {
                        "size": self._dimensions,
                        "distance": "Cosine",
                    }
                },
            )
            create_response.raise_for_status()
        else:
            response.raise_for_status()

        self._collection_checked = True
