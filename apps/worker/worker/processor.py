from __future__ import annotations

from typing import Literal, Protocol, TypedDict


DocumentStatus = Literal["processing", "ready", "failed"]


class ProcessingDocument(TypedDict, total=False):
    id: str
    filename: str
    status: DocumentStatus
    error_message: str


class DocumentRepository(Protocol):
    def claim_next_processing_document(self) -> ProcessingDocument | None:
        ...

    def mark_ready(self, document: ProcessingDocument) -> None:
        ...

    def mark_failed(self, document: ProcessingDocument, error_message: str) -> None:
        ...


class InMemoryDocumentRepository:
    def __init__(self, documents: list[ProcessingDocument] | None = None) -> None:
        self.documents = documents or []

    def claim_next_processing_document(self) -> ProcessingDocument | None:
        for document in self.documents:
            if document.get("status") == "processing":
                return document
        return None

    def mark_ready(self, document: ProcessingDocument) -> None:
        document["status"] = "ready"

    def mark_failed(self, document: ProcessingDocument, error_message: str) -> None:
        document["status"] = "failed"
        document["error_message"] = error_message


class WorkerProcessor:
    def __init__(self, repository: DocumentRepository) -> None:
        self.repository = repository

    def process_once(self) -> bool:
        document = self.repository.claim_next_processing_document()
        if document is None:
            return False

        try:
            self._process_document(document)
        except Exception as exc:
            self.repository.mark_failed(document, str(exc))
        else:
            self.repository.mark_ready(document)

        return True

    def _process_document(self, document: ProcessingDocument) -> None:
        filename = document.get("filename", "")
        if not filename.endswith((".pdf", ".docx")):
            raise ValueError("Unsupported document type")
