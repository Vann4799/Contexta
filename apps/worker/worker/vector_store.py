from __future__ import annotations

import hashlib
import math

import httpx

from worker.processor import ProcessingChunk, ProcessingDocument


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
        point_ids = [
            f"{chunk['document_id']}-{chunk['chunk_index']}" for chunk in chunks
        ]
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
