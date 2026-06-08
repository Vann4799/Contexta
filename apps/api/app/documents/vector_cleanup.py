from typing import Protocol

import httpx


class DocumentVectorCleanup(Protocol):
    def delete_document_vectors(self, user_id: str, document_id: str) -> None:
        ...


class NoopDocumentVectorCleanup:
    def delete_document_vectors(self, user_id: str, document_id: str) -> None:
        return None


class QdrantDocumentVectorCleanup:
    def __init__(
        self,
        qdrant_url: str,
        collection_name: str,
        api_key: str = "",
        client: httpx.Client | None = None,
    ) -> None:
        self._qdrant_url = qdrant_url.rstrip("/")
        self._collection_name = collection_name
        self._headers = {"api-key": api_key} if api_key else None
        self._client = client or httpx.Client(timeout=30)

    def delete_document_vectors(self, user_id: str, document_id: str) -> None:
        response = self._client.post(
            f"{self._qdrant_url}/collections/{self._collection_name}/points/delete",
            headers=self._headers,
            json={
                "filter": {
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}},
                        {"key": "document_id", "match": {"value": document_id}},
                    ]
                }
            },
        )
        if response.status_code == 404:
            return
        response.raise_for_status()
