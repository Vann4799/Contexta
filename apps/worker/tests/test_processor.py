from typing import Any

from worker.processor import InMemoryDocumentRepository, WorkerProcessor


ExtractedDocument = dict[str, list[dict[str, str | int]]]
ProcessingChunk = dict[str, Any]


class FakeStorage:
    def __init__(self, objects: dict[str, bytes]) -> None:
        self.objects = objects

    def download_document(self, storage_path: str) -> bytes:
        return self.objects[storage_path]


class FakeExtractor:
    def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
        assert content == b"document bytes"
        assert file_type == "pdf"
        return {
            "pages": [
                {"page_number": 1, "text": "one two three four"},
                {"page_number": 2, "text": "five six seven eight"},
            ]
        }


class FakeEmbeddingProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[float(index), 1.0] for index, _ in enumerate(texts)]


class FakeVectorStore:
    def __init__(self) -> None:
        self.upserted: list[ProcessingChunk] = []

    def upsert_chunks(
        self,
        document: dict[str, str],
        chunks: list[ProcessingChunk],
        embeddings: list[list[float]],
    ) -> list[str]:
        assert len(chunks) == len(embeddings)
        self.upserted = chunks
        return [f"point-{chunk['chunk_index']}" for chunk in chunks]


def test_process_once_marks_processing_document_ready() -> None:
    repository = InMemoryDocumentRepository(
        [
            {
                "id": "doc-1",
                "user_id": "user-1",
                "filename": "contract.pdf",
                "file_type": "pdf",
                "storage_path": "user-1/doc-1.pdf",
                "status": "processing",
            }
        ]
    )
    vector_store = FakeVectorStore()
    processor = WorkerProcessor(
        repository=repository,
        storage=FakeStorage({"user-1/doc-1.pdf": b"document bytes"}),
        extractor=FakeExtractor(),
        embedding_provider=FakeEmbeddingProvider(),
        vector_store=vector_store,
        max_chunk_words=4,
        overlap_words=0,
        min_chunk_words=0,
    )

    processed = processor.process_once()

    assert processed is True
    assert repository.documents[0]["status"] == "ready"
    assert repository.documents[0]["chunk_count"] == 2
    assert repository.chunks == [
        {
            "document_id": "doc-1",
            "user_id": "user-1",
            "chunk_index": 0,
            "text": "one two three four",
            "page_number": 1,
            "qdrant_point_id": "point-0",
        },
        {
            "document_id": "doc-1",
            "user_id": "user-1",
            "chunk_index": 1,
            "text": "five six seven eight",
            "page_number": 2,
            "qdrant_point_id": "point-1",
        },
    ]
    assert [chunk["text"] for chunk in vector_store.upserted] == [
        "one two three four",
        "five six seven eight",
    ]


def test_short_pages_are_merged_into_one_document_window() -> None:
    class ThreePageExtractor:
        def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
            return {
                "pages": [
                    {"page_number": 1, "text": "satu dua tiga"},
                    {"page_number": 2, "text": "empat lima enam"},
                    {"page_number": 3, "text": "tujuh delapan sembilan"},
                ]
            }

    repository = InMemoryDocumentRepository(
        [
            {
                "id": "doc-1",
                "user_id": "user-1",
                "filename": "skripsi.pdf",
                "file_type": "pdf",
                "storage_path": "user-1/doc-1.pdf",
                "status": "processing",
            }
        ]
    )
    processor = WorkerProcessor(
        repository=repository,
        storage=FakeStorage({"user-1/doc-1.pdf": b"document bytes"}),
        extractor=ThreePageExtractor(),
        embedding_provider=FakeEmbeddingProvider(),
        vector_store=FakeVectorStore(),
        max_chunk_words=50,
        overlap_words=10,
        min_chunk_words=5,
    )

    processor.process_once()

    assert repository.documents[0]["chunk_count"] == 1
    assert repository.chunks[0]["text"] == (
        "satu dua tiga\nempat lima enam\ntujuh delapan sembilan"
    )
    assert repository.chunks[0]["page_number"] == 1


def test_process_once_returns_false_when_no_document_available() -> None:
    repository = InMemoryDocumentRepository([])
    processor = WorkerProcessor(repository)

    processed = processor.process_once()

    assert processed is False


def test_process_once_marks_document_failed_when_extraction_has_no_text() -> None:
    class EmptyExtractor:
        def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
            return {"pages": [{"page_number": 1, "text": "   "}]}

    repository = InMemoryDocumentRepository(
        [
            {
                "id": "doc-1",
                "user_id": "user-1",
                "filename": "empty.pdf",
                "file_type": "pdf",
                "storage_path": "user-1/doc-1.pdf",
                "status": "processing",
            }
        ]
    )
    processor = WorkerProcessor(
        repository=repository,
        storage=FakeStorage({"user-1/doc-1.pdf": b"document bytes"}),
        extractor=EmptyExtractor(),
        embedding_provider=FakeEmbeddingProvider(),
        vector_store=FakeVectorStore(),
    )

    processed = processor.process_once()

    assert processed is True
    assert repository.documents[0]["status"] == "failed"
    assert repository.documents[0]["error_message"] == "No extractable text found"
