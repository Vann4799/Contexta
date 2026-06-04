from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

import httpx

from app.documents.models import DocumentCreate, DocumentResponse
from app.documents.models import DocumentChunkResponse


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

    def add_chunks(self, chunks: list[dict[str, object]]) -> None:
        self._chunks.extend(DocumentChunkResponse.model_validate(chunk) for chunk in chunks)


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
        created = response.json()
        if isinstance(created, list):
            created = created[0]
        return DocumentResponse.model_validate(created)

    def get_document(self, user_id: str, document_id: str) -> DocumentResponse | None:
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
        response = httpx.get(
            f"{self._supabase_url}/rest/v1/document_chunks",
            headers=self._headers,
            params={
                "document_id": f"eq.{document_id}",
                "user_id": f"eq.{user_id}",
                "order": "chunk_index.asc",
                "select": "document_id,user_id,chunk_index,text,page_number,qdrant_point_id",
            },
        )
        response.raise_for_status()
        return [
            DocumentChunkResponse.model_validate(chunk)
            for chunk in response.json()
        ]


document_repository = InMemoryDocumentRepository()
