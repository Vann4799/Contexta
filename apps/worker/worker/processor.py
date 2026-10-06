from __future__ import annotations

import sys
from pathlib import Path
from typing import Literal, Protocol, TypedDict

try:
    from contexta_rag.chunking import chunk_pages
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[3] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.chunking import chunk_pages


DocumentStatus = Literal["processing", "ready", "failed"]


class ProcessingDocument(TypedDict, total=False):
    id: str
    user_id: str
    filename: str
    file_type: str
    storage_path: str
    status: DocumentStatus
    error_message: str
    chunk_count: int


class ExtractedPage(TypedDict):
    page_number: int
    text: str


class ExtractedDocument(TypedDict):
    pages: list[ExtractedPage]


class ProcessingChunk(TypedDict):
    document_id: str
    user_id: str
    chunk_index: int
    text: str
    page_number: int | None
    qdrant_point_id: str


class DocumentStorage(Protocol):
    def download_document(self, storage_path: str) -> bytes:
        ...


class DocumentExtractor(Protocol):
    def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
        ...


class EmbeddingProvider(Protocol):
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


class VectorStore(Protocol):
    def upsert_chunks(
        self,
        document: ProcessingDocument,
        chunks: list[ProcessingChunk],
        embeddings: list[list[float]],
    ) -> list[str]:
        ...


class DocumentRepository(Protocol):
    def claim_next_processing_document(self) -> ProcessingDocument | None:
        ...

    def mark_ready(self, document: ProcessingDocument) -> None:
        ...

    def mark_failed(self, document: ProcessingDocument, error_message: str) -> None:
        ...

    def replace_chunks(
        self, document: ProcessingDocument, chunks: list[ProcessingChunk]
    ) -> None:
        ...


class InMemoryDocumentRepository:
    def __init__(self, documents: list[ProcessingDocument] | None = None) -> None:
        self.documents = documents or []
        self.chunks: list[ProcessingChunk] = []

    def claim_next_processing_document(self) -> ProcessingDocument | None:
        for document in self.documents:
            if document.get("status") == "processing":
                return document
        return None

    def mark_ready(self, document: ProcessingDocument, chunk_count: int = 0) -> None:
        document["status"] = "ready"
        document["chunk_count"] = chunk_count

    def mark_failed(self, document: ProcessingDocument, error_message: str) -> None:
        document["status"] = "failed"
        document["error_message"] = error_message

    def replace_chunks(
        self, document: ProcessingDocument, chunks: list[ProcessingChunk]
    ) -> None:
        document_id = document["id"]
        self.chunks = [
            chunk for chunk in self.chunks if chunk["document_id"] != document_id
        ]
        self.chunks.extend(chunks)


class MissingDocumentStorage:
    def download_document(self, storage_path: str) -> bytes:
        raise RuntimeError("Document storage is not configured")


class MissingDocumentExtractor:
    def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
        raise RuntimeError("Document extractor is not configured")


class MissingEmbeddingProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        raise RuntimeError("Embedding provider is not configured")


class MissingVectorStore:
    def upsert_chunks(
        self,
        document: ProcessingDocument,
        chunks: list[ProcessingChunk],
        embeddings: list[list[float]],
    ) -> list[str]:
        raise RuntimeError("Vector store is not configured")


class WorkerProcessor:
    def __init__(
        self,
        repository: DocumentRepository,
        storage: DocumentStorage | None = None,
        extractor: DocumentExtractor | None = None,
        embedding_provider: EmbeddingProvider | None = None,
        vector_store: VectorStore | None = None,
        max_chunk_words: int = 500,
        overlap_words: int = 100,
        min_chunk_words: int = 40,
    ) -> None:
        self.repository = repository
        self.storage = storage or MissingDocumentStorage()
        self.extractor = extractor or MissingDocumentExtractor()
        self.embedding_provider = embedding_provider or MissingEmbeddingProvider()
        self.vector_store = vector_store or MissingVectorStore()
        self.max_chunk_words = max_chunk_words
        self.overlap_words = overlap_words
        self.min_chunk_words = min_chunk_words

    def process_once(self) -> bool:
        document = self.repository.claim_next_processing_document()
        if document is None:
            return False

        try:
            self._process_document(document)
        except Exception as exc:
            self.repository.mark_failed(document, str(exc))

        return True

    def _process_document(self, document: ProcessingDocument) -> None:
        filename = document.get("filename", "")
        if not filename.endswith((".pdf", ".docx")):
            raise ValueError("Unsupported document type")

        content = self.storage.download_document(document["storage_path"])
        extracted_document = self.extractor.extract(content, document["file_type"])
        chunks = self._build_chunks(document, extracted_document)
        if not chunks:
            raise ValueError("No extractable text found")

        embeddings = self.embedding_provider.embed_texts(
            [chunk["text"] for chunk in chunks]
        )
        if len(embeddings) != len(chunks):
            raise ValueError("Embedding count did not match chunk count")

        point_ids = self.vector_store.upsert_chunks(document, chunks, embeddings)
        if len(point_ids) != len(chunks):
            raise ValueError("Vector point count did not match chunk count")

        chunks_with_points: list[ProcessingChunk] = []
        for chunk, point_id in zip(chunks, point_ids):
            chunks_with_points.append({**chunk, "qdrant_point_id": point_id})

        self.repository.replace_chunks(document, chunks_with_points)
        self.repository.mark_ready(document, len(chunks_with_points))

    def _build_chunks(
        self, document: ProcessingDocument, extracted_document: ExtractedDocument
    ) -> list[ProcessingChunk]:
        page_chunks = chunk_pages(
            extracted_document["pages"],
            max_words=self.max_chunk_words,
            overlap_words=self.overlap_words,
            min_words=self.min_chunk_words,
        )

        return [
            {
                "document_id": document["id"],
                "user_id": document["user_id"],
                "chunk_index": page_chunk["chunk_index"],
                "text": page_chunk["text"],
                "page_number": page_chunk["page_number"],
                "qdrant_point_id": "",
            }
            for page_chunk in page_chunks
        ]
