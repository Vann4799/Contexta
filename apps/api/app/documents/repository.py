from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

import httpx

from app.documents.models import DocumentCreate, DocumentResponse


class DocumentRepository(Protocol):
    def list_documents(self, user_id: str) -> list[DocumentResponse]:
        ...

    def create_document(
        self,
        user_id: str,
        document: DocumentCreate,
    ) -> DocumentResponse:
        ...


class InMemoryDocumentRepository:
    def __init__(self) -> None:
        self._documents: list[DocumentResponse] = []

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


document_repository = InMemoryDocumentRepository()
