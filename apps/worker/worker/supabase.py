from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx

from worker.processor import ProcessingChunk, ProcessingDocument, UserVisibleError


# Supabase Storage reports a missing key as HTTP 400 with the real status in the
# body ({"statusCode":"404","error":"not_found","code":"NoSuchKey"}), not as 404.
def _is_missing_object(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    if response.status_code != 400:
        return False
    body = response.text
    return "not_found" in body or "NoSuchKey" in body


class SupabaseDocumentRepository:
    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        client: httpx.Client | None = None,
    ) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key
        self._client = client or httpx.Client(timeout=30)

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
        }

    def claim_next_processing_document(self) -> ProcessingDocument | None:
        response = self._client.get(
            f"{self._supabase_url}/rest/v1/documents",
            headers=self._headers,
            params={
                "status": "eq.processing",
                "order": "created_at.asc",
                "limit": "1",
            },
        )
        response.raise_for_status()
        documents = response.json()
        if not documents:
            return None

        document = documents[0]
        claim_response = self._client.patch(
            f"{self._supabase_url}/rest/v1/documents",
            headers={
                **self._headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{document['id']}",
                "status": "eq.processing",
            },
            json={
                "status": "processing",
                "processing_started_at": datetime.now(timezone.utc).isoformat(),
                "error_message": None,
            },
        )
        claim_response.raise_for_status()
        claimed_documents = claim_response.json()
        if not claimed_documents:
            return None
        return claimed_documents[0]

    def get_document(self, document_id: str) -> ProcessingDocument | None:
        response = self._client.get(
            f"{self._supabase_url}/rest/v1/documents",
            headers=self._headers,
            params={"id": f"eq.{document_id}", "limit": "1"},
        )
        response.raise_for_status()
        documents = response.json()
        return documents[0] if documents else None

    def list_documents(self) -> list[ProcessingDocument]:
        response = self._client.get(
            f"{self._supabase_url}/rest/v1/documents",
            headers=self._headers,
            params={"order": "created_at.asc"},
        )
        response.raise_for_status()
        return response.json()

    def replace_chunks(
        self, document: ProcessingDocument, chunks: list[ProcessingChunk]
    ) -> None:
        delete_response = self._client.delete(
            f"{self._supabase_url}/rest/v1/document_chunks",
            headers=self._headers,
            params={"document_id": f"eq.{document['id']}"},
        )
        delete_response.raise_for_status()

        if not chunks:
            return

        insert_response = self._client.post(
            f"{self._supabase_url}/rest/v1/document_chunks",
            headers={
                **self._headers,
                "Content-Type": "application/json",
            },
            json=chunks,
        )
        insert_response.raise_for_status()

    def mark_ready(
        self,
        document: ProcessingDocument,
        chunk_count: int = 0,
        index_metadata: dict[str, object] | None = None,
    ) -> None:
        self._update_document(
            document,
            {
                "status": "ready",
                "chunk_count": chunk_count,
                "error_message": None,
                **(index_metadata or {}),
            },
        )

    def mark_failed(self, document: ProcessingDocument, error_message: str) -> None:
        self._update_document(
            document,
            {
                "status": "failed",
                "error_message": error_message[:1000],
            },
        )

    def prune_api_request_logs(self, retention_days: int) -> int:
        """Drop /v1 audit rows past the retention window.

        This runs in the worker rather than the API because it is a bulk delete on the
        same table the request hot path inserts into; doing it inline would put cleanup
        latency in front of a paying caller.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        response = self._client.delete(
            f"{self._supabase_url}/rest/v1/api_request_logs",
            headers={**self._headers, "Prefer": "count=exact"},
            params={"created_at": f"lt.{cutoff.isoformat()}"},
        )
        response.raise_for_status()
        content_range = response.headers.get("content-range") or ""
        # PostgREST reports the affected count only in Content-Range when Prefer: count
        # is sent; the DELETE body is empty.
        _, _, total = content_range.rpartition("/")
        return int(total) if total.isdigit() else 0

    def _update_document(
        self, document: ProcessingDocument, payload: dict[str, object]
    ) -> None:
        response = self._client.patch(
            f"{self._supabase_url}/rest/v1/documents",
            headers={
                **self._headers,
                "Content-Type": "application/json",
            },
            params={"id": f"eq.{document['id']}"},
            json=payload,
        )
        response.raise_for_status()


class SupabaseDocumentStorage:
    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        bucket: str,
        client: httpx.Client | None = None,
    ) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key
        self._bucket = bucket
        self._client = client or httpx.Client(timeout=60)

    def download_document(self, storage_path: str) -> bytes:
        encoded_storage_path = "/".join(
            quote(segment, safe="") for segment in storage_path.split("/")
        )
        response = self._client.get(
            f"{self._supabase_url}/storage/v1/object/{self._bucket}/{encoded_storage_path}",
            headers={
                "apikey": self._service_role_key,
                "Authorization": f"Bearer {self._service_role_key}",
            },
        )
        if _is_missing_object(response):
            raise UserVisibleError("Stored file is no longer available")
        response.raise_for_status()
        return response.content
