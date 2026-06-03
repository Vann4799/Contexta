from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

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


document_repository = InMemoryDocumentRepository()
