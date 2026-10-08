from __future__ import annotations

import logging
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, NamedTuple, Protocol, TypedDict

try:
    from contexta_rag.chunking import chunk_pages
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[3] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.chunking import chunk_pages


logger = logging.getLogger(__name__)

DocumentStatus = Literal["processing", "ready", "failed"]

CHUNKER_VERSION = "window-v2"
_TOKENS_PER_CHAR = 4

UNEXPECTED_FAILURE_MESSAGE = "Indexing failed unexpectedly. Please retry."


class UserVisibleError(Exception):
    """A failure the worker can describe safely.

    ``error_message`` is rendered in the document owner's browser, so only
    messages written by this codebase may land there; anything else is logged
    verbatim and replaced by a generic sentence.
    """


class ProcessingDocument(TypedDict, total=False):
    id: str
    user_id: str
    filename: str
    file_type: str
    storage_path: str
    status: DocumentStatus
    error_message: str
    chunk_count: int
    doc_type: str
    doc_version: str
    source_url: str


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
    section_path: str | None
    is_table: bool
    char_count: int
    token_count: int
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


class EmbeddingArm(NamedTuple):
    """One embedder and the Qdrant vector slot its output belongs in ("" = default)."""

    name: str
    provider: EmbeddingProvider


class VectorStore(Protocol):
    def upsert_chunks(
        self,
        document: ProcessingDocument,
        chunks: list[ProcessingChunk],
        embeddings: dict[str, list[list[float]]],
    ) -> list[str]:
        ...

    def prune_stale_chunks(self, document_id: str, chunk_count: int) -> None:
        ...


class DocumentRepository(Protocol):
    def claim_next_processing_document(self) -> ProcessingDocument | None:
        ...

    def get_document(self, document_id: str) -> ProcessingDocument | None:
        ...

    def list_documents(self) -> list[ProcessingDocument]:
        ...

    def mark_ready(
        self,
        document: ProcessingDocument,
        chunk_count: int = 0,
        index_metadata: dict[str, object] | None = None,
    ) -> None:
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

    def get_document(self, document_id: str) -> ProcessingDocument | None:
        for document in self.documents:
            if document.get("id") == document_id:
                return document
        return None

    def list_documents(self) -> list[ProcessingDocument]:
        return list(self.documents)

    def mark_ready(
        self,
        document: ProcessingDocument,
        chunk_count: int = 0,
        index_metadata: dict[str, object] | None = None,
    ) -> None:
        document["status"] = "ready"
        document["chunk_count"] = chunk_count
        if index_metadata:
            document.update(index_metadata)  # type: ignore[typeddict-item]

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
        raise UserVisibleError("Document storage is not configured")


class MissingDocumentExtractor:
    def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
        raise UserVisibleError("Document extractor is not configured")


class MissingEmbeddingProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        raise UserVisibleError("Embedding provider is not configured")


class MissingVectorStore:
    def upsert_chunks(
        self,
        document: ProcessingDocument,
        chunks: list[ProcessingChunk],
        embeddings: dict[str, list[list[float]]],
    ) -> list[str]:
        raise UserVisibleError("Vector store is not configured")

    def prune_stale_chunks(self, document_id: str, chunk_count: int) -> None:
        raise UserVisibleError("Vector store is not configured")


class WorkerProcessor:
    def __init__(
        self,
        repository: DocumentRepository,
        storage: DocumentStorage | None = None,
        extractor: DocumentExtractor | None = None,
        embedding_arms: list[EmbeddingArm] | None = None,
        vector_store: VectorStore | None = None,
        max_chunk_words: int = 500,
        overlap_words: int = 100,
        min_chunk_words: int = 40,
        index_metadata: dict[str, object] | None = None,
    ) -> None:
        self.repository = repository
        self.storage = storage or MissingDocumentStorage()
        self.extractor = extractor or MissingDocumentExtractor()
        self.embedding_arms = embedding_arms or [
            EmbeddingArm(name="", provider=MissingEmbeddingProvider())
        ]
        self.vector_store = vector_store or MissingVectorStore()
        self.max_chunk_words = max_chunk_words
        self.overlap_words = overlap_words
        self.min_chunk_words = min_chunk_words
        self.index_metadata = {"chunker_version": CHUNKER_VERSION, **(index_metadata or {})}

    def process_once(self) -> bool:
        document = self.repository.claim_next_processing_document()
        if document is None:
            return False

        try:
            self.process_document(document)
        except UserVisibleError as exc:
            self.repository.mark_failed(document, str(exc))
        except Exception:
            logger.exception(
                "unexpected indexing failure for document %s", document["id"]
            )
            self.repository.mark_failed(document, UNEXPECTED_FAILURE_MESSAGE)

        return True

    def process_document(self, document: ProcessingDocument) -> int:
        filename = document.get("filename", "")
        if not filename.endswith((".pdf", ".docx")):
            raise UserVisibleError("Unsupported document type")

        content = self.storage.download_document(document["storage_path"])
        extracted_document = self.extractor.extract(content, document["file_type"])
        chunks = self._build_chunks(document, extracted_document)
        if not chunks:
            raise UserVisibleError("No extractable text found")

        embeddings = self._embed_arms(chunks)

        point_ids = self.vector_store.upsert_chunks(document, chunks, embeddings)
        if len(point_ids) != len(chunks):
            raise UserVisibleError("Vector point count did not match chunk count")

        self.vector_store.prune_stale_chunks(document["id"], len(chunks))

        chunks_with_points: list[ProcessingChunk] = []
        for chunk, point_id in zip(chunks, point_ids):
            chunks_with_points.append({**chunk, "qdrant_point_id": point_id})

        self.repository.replace_chunks(document, chunks_with_points)
        self.repository.mark_ready(
            document,
            len(chunks_with_points),
            {
                "indexed_at": datetime.now(timezone.utc).isoformat(),
                **self.index_metadata,
            },
        )
        return len(chunks_with_points)

    def _embed_arms(
        self, chunks: list[ProcessingChunk]
    ) -> dict[str, list[list[float]]]:
        """Embed the same chunk texts once per arm, keyed by Qdrant vector slot.

        An arm returning the wrong count would misalign vectors with chunks
        inside the point payload, so it fails the document instead of indexing
        a half-shifted collection.
        """
        texts = [chunk["text"] for chunk in chunks]
        embeddings: dict[str, list[list[float]]] = {}
        for arm in self.embedding_arms:
            vectors = arm.provider.embed_texts(texts)
            if len(vectors) != len(chunks):
                raise UserVisibleError(
                    f"embedding arm '{arm.name or 'default'}' returned "
                    f"{len(vectors)} vectors for {len(chunks)} chunks"
                )
            embeddings[arm.name] = vectors
        return embeddings

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
                "section_path": page_chunk["section_path"],
                "is_table": page_chunk["is_table"],
                "char_count": len(page_chunk["text"]),
                "token_count": math.ceil(len(page_chunk["text"]) / _TOKENS_PER_CHAR),
                "qdrant_point_id": "",
            }
            for page_chunk in page_chunks
        ]
