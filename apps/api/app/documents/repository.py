from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

import httpx

from app.core.ids import is_uuid
from app.core.postgrest import first_row
from app.documents.models import DocumentCreate, DocumentResponse
from app.documents.models import DocumentChunkResponse

CHUNK_COLUMNS = (
    "document_id,user_id,chunk_index,text,page_number,"
    "section_path,is_table,char_count,token_count,qdrant_point_id"
)


def _total_from_content_range(header: str | None) -> int:
    # With Prefer: count PostgREST reports "<first>-<last>/<total>" for the whole
    # filtered set, not just the page it returned.
    if not header or "/" not in header:
        return 0
    try:
        return int(header.rsplit("/", 1)[1])
    except ValueError:
        return 0


class DocumentRepository(Protocol):
    def list_documents(self, user_id: str) -> list[DocumentResponse]:
        ...

    def create_document(
        self,
        user_id: str,
        document: DocumentCreate,
    ) -> DocumentResponse:
        ...

    def get_document(self, user_id: str, document_id: str) -> DocumentResponse | None:
        ...

    def list_document_chunks(
        self,
        user_id: str,
        document_id: str,
    ) -> list[DocumentChunkResponse]:
        ...

    def chunk_page(
        self,
        user_id: str,
        document_id: str,
        page: int,
        page_size: int,
    ) -> tuple[list[DocumentChunkResponse], int]:
        ...

    def delete_document(self, user_id: str, document_id: str) -> None:
        ...

    def retry_failed_document(
        self,
        user_id: str,
        document_id: str,
    ) -> DocumentResponse | None:
        ...

    def reindex_ready_document(
        self,
        user_id: str,
        document_id: str,
    ) -> DocumentResponse | None:
        ...

    def update_document_metadata(
        self,
        user_id: str,
        document_id: str,
        changes: dict[str, object],
    ) -> DocumentResponse | None:
        ...


class InMemoryDocumentRepository:
    def __init__(self) -> None:
        self._documents: list[DocumentResponse] = []
        self._chunks: list[DocumentChunkResponse] = []

    def list_documents(self, user_id: str) -> list[DocumentResponse]:
        return [document for document in self._documents if document.user_id == user_id]

    def create_document(
        self,
        user_id: str,
        document: DocumentCreate,
    ) -> DocumentResponse:
        now = datetime.now(timezone.utc)
        created_document = DocumentResponse(
            id=str(uuid4()),
            user_id=user_id,
            filename=document.filename,
            file_type=document.file_type,
            file_size=document.file_size,
            storage_path=document.storage_path,
            status="processing",
            error_message=None,
            chunk_count=0,
            doc_type=document.doc_type,
            source_url=document.source_url,
            doc_version=document.doc_version,
            created_at=now,
            updated_at=now,
        )
        self._documents.append(created_document)
        return created_document

    def get_document(self, user_id: str, document_id: str) -> DocumentResponse | None:
        for document in self._documents:
            if document.user_id == user_id and document.id == document_id:
                return document
        return None

    def list_document_chunks(
        self,
        user_id: str,
        document_id: str,
    ) -> list[DocumentChunkResponse]:
        return [
            chunk
            for chunk in sorted(self._chunks, key=lambda item: item.chunk_index)
            if chunk.user_id == user_id and chunk.document_id == document_id
        ]

    def chunk_page(
        self,
        user_id: str,
        document_id: str,
        page: int,
        page_size: int,
    ) -> tuple[list[DocumentChunkResponse], int]:
        chunks = self.list_document_chunks(user_id, document_id)
        start = (page - 1) * page_size
        return chunks[start : start + page_size], len(chunks)

    def add_chunks(self, chunks: list[dict[str, object]]) -> None:
        self._chunks.extend(DocumentChunkResponse.model_validate(chunk) for chunk in chunks)

    def mark_failed(self, document_id: str, error_message: str) -> None:
        for index, document in enumerate(self._documents):
            if document.id == document_id:
                self._documents[index] = document.model_copy(
                    update={
                        "status": "failed",
                        "error_message": error_message,
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
                return

    def delete_document(self, user_id: str, document_id: str) -> None:
        self._documents = [
            document
            for document in self._documents
            if not (document.user_id == user_id and document.id == document_id)
        ]
        self._chunks = [
            chunk
            for chunk in self._chunks
            if not (chunk.user_id == user_id and chunk.document_id == document_id)
        ]

    def retry_failed_document(
        self,
        user_id: str,
        document_id: str,
    ) -> DocumentResponse | None:
        now = datetime.now(timezone.utc)
        for index, document in enumerate(self._documents):
            if document.user_id == user_id and document.id == document_id:
                retried = document.model_copy(
                    update={
                        "status": "processing",
                        "error_message": None,
                        "chunk_count": 0,
                        "updated_at": now,
                    }
                )
                self._documents[index] = retried
                self._chunks = [
                    chunk
                    for chunk in self._chunks
                    if not (chunk.user_id == user_id and chunk.document_id == document_id)
                ]
                return retried
        return None

    def reindex_ready_document(
        self,
        user_id: str,
        document_id: str,
    ) -> DocumentResponse | None:
        now = datetime.now(timezone.utc)
        for index, document in enumerate(self._documents):
            if (
                document.user_id == user_id
                and document.id == document_id
                and document.status == "ready"
            ):
                reindexed = document.model_copy(
                    update={
                        "status": "processing",
                        "error_message": None,
                        "chunk_count": 0,
                        "updated_at": now,
                    }
                )
                self._documents[index] = reindexed
                return reindexed
        return None

    def update_document_metadata(
        self,
        user_id: str,
        document_id: str,
        changes: dict[str, object],
    ) -> DocumentResponse | None:
        for index, document in enumerate(self._documents):
            if document.user_id == user_id and document.id == document_id:
                updated = document.model_copy(
                    update={**changes, "updated_at": datetime.now(timezone.utc)}
                )
                self._documents[index] = updated
                return updated
        return None


class SupabaseDocumentRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
        }

    def list_documents(self, user_id: str) -> list[DocumentResponse]:
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/documents",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
            },
        )
        response.raise_for_status()
        return [
            DocumentResponse.model_validate(document)
            for document in response.json()
        ]

    def create_document(
        self,
        user_id: str,
        document: DocumentCreate,
    ) -> DocumentResponse:
        headers = {
            **self._headers,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        payload = document.model_dump()
        payload["user_id"] = user_id

        response = httpx.post(
            f"{self._supabase_url}/rest/v1/documents",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        return DocumentResponse.model_validate(first_row(response.json(), "document"))

    def get_document(self, user_id: str, document_id: str) -> DocumentResponse | None:
        if not is_uuid(document_id):
            # `documents.id` is a uuid column, so this id cannot name a row; asking
            # PostgREST anyway gets a 400 back and the client would see a 500.
            return None
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/documents",
            headers=self._headers,
            params={
                "id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
        )
        response.raise_for_status()
        documents = response.json()
        if not documents:
            return None
        return DocumentResponse.model_validate(documents[0])

    def list_document_chunks(
        self,
        user_id: str,
        document_id: str,
    ) -> list[DocumentChunkResponse]:
        if not is_uuid(document_id):
            return []
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/document_chunks",
            headers=self._headers,
            params={
                "document_id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
                "order": "chunk_index.asc",
                "select": CHUNK_COLUMNS,
            },
        )
        response.raise_for_status()
        return [
            DocumentChunkResponse.model_validate(chunk)
            for chunk in response.json()
        ]

    def chunk_page(
        self,
        user_id: str,
        document_id: str,
        page: int,
        page_size: int,
    ) -> tuple[list[DocumentChunkResponse], int]:
        if not is_uuid(document_id):
            return [], 0
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/document_chunks",
            headers={**self._headers, "Prefer": "count=exact"},
            params={
                "document_id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
                "order": "chunk_index.asc",
                "offset": str((page - 1) * page_size),
                "limit": str(page_size),
                "select": CHUNK_COLUMNS,
            },
        )
        total = _total_from_content_range(response.headers.get("content-range"))
        if response.status_code == 416:
            # Measured live: PostgREST answers an offset past the last row with
            # 416 PGRST103 instead of an empty page, and Content-Range still
            # reports the real count as "*/<total>".
            return [], total
        response.raise_for_status()
        return (
            [
                DocumentChunkResponse.model_validate(chunk)
                for chunk in response.json()
            ],
            total,
        )

    def delete_document(self, user_id: str, document_id: str) -> None:
        if not is_uuid(document_id):
            return
        response = httpx.delete(
            f"{self._supabase_url}/rest/v1/documents",
            headers=self._headers,
            params={
                "id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
            },
        )
        response.raise_for_status()

    def retry_failed_document(
        self,
        user_id: str,
        document_id: str,
    ) -> DocumentResponse | None:
        if not is_uuid(document_id):
            return None
        headers = {
            **self._headers,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        response = httpx.patch(
            f"{self._supabase_url}/rest/v1/documents",
            headers=headers,
            params={
                "id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
                "status": "eq.failed",
            },
            json={
                "status": "processing",
                "error_message": None,
                "chunk_count": 0,
                "processing_started_at": None,
            },
        )
        response.raise_for_status()
        documents = response.json()
        if not documents:
            return None

        # The worker only rewrites chunks on a successful pass, so a retry that fails
        # again would otherwise keep serving the previous attempt's text under a
        # chunk_count of zero. The in-memory double has always cleared them.
        cleanup = httpx.delete(
            f"{self._supabase_url}/rest/v1/document_chunks",
            headers=self._headers,
            params={
                "document_id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
            },
        )
        cleanup.raise_for_status()
        return DocumentResponse.model_validate(documents[0])

    def reindex_ready_document(
        self,
        user_id: str,
        document_id: str,
    ) -> DocumentResponse | None:
        if not is_uuid(document_id):
            return None
        headers = {
            **self._headers,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        response = httpx.patch(
            f"{self._supabase_url}/rest/v1/documents",
            headers=headers,
            params={
                "id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
                "status": "eq.ready",
            },
            json={
                "status": "processing",
                "error_message": None,
                "chunk_count": 0,
                "processing_started_at": None,
            },
        )
        response.raise_for_status()
        documents = response.json()
        if not documents:
            return None
        return DocumentResponse.model_validate(documents[0])

    def update_document_metadata(
        self,
        user_id: str,
        document_id: str,
        changes: dict[str, object],
    ) -> DocumentResponse | None:
        if not changes:
            return self.get_document(user_id, document_id)

        if not is_uuid(document_id):
            return None

        response = httpx.patch(
            f"{self._supabase_url}/rest/v1/documents",
            headers={
                **self._headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
            },
            json=changes,
        )
        response.raise_for_status()
        documents = response.json()
        if not documents:
            return None
        return DocumentResponse.model_validate(documents[0])


document_repository = InMemoryDocumentRepository()
