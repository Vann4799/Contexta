from typing import Any

from worker.processor import (
    UNEXPECTED_FAILURE_MESSAGE,
    EmbeddingArm,
    InMemoryDocumentRepository,
    UserVisibleError,
    WorkerProcessor,
)


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
    def __init__(self, tag: float = 1.0, drop_last: bool = False) -> None:
        self.tag = tag
        self.drop_last = drop_last
        self.calls = 0

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        self.calls += 1
        vectors = [[float(index), self.tag] for index, _ in enumerate(texts)]
        return vectors[:-1] if self.drop_last and len(vectors) > 1 else vectors


class FakeVectorStore:
    def __init__(self) -> None:
        self.upserted: list[ProcessingChunk] = []
        self.pruned: list[tuple[str, int]] = []
        self.deleted: list[str] = []
        self.embeddings: dict[str, list[list[float]]] = {}

    def upsert_chunks(
        self,
        document: dict[str, str],
        chunks: list[ProcessingChunk],
        embeddings: dict[str, list[list[float]]],
    ) -> list[str]:
        assert all(len(vectors) == len(chunks) for vectors in embeddings.values())
        self.upserted = chunks
        self.embeddings = embeddings
        return [f"point-{chunk['chunk_index']}" for chunk in chunks]

    def prune_stale_chunks(self, document_id: str, chunk_count: int) -> None:
        self.pruned.append((document_id, chunk_count))

    def delete_document_vectors(self, document_id: str) -> None:
        self.deleted.append(document_id)


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
        embedding_arms=[EmbeddingArm(name="", provider=FakeEmbeddingProvider())],
        vector_store=vector_store,
        max_chunk_words=4,
        overlap_words=0,
        min_chunk_words=0,
        index_metadata={"embedding_model": "fake-model", "embedding_dimensions": 2},
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
            "section_path": None,
            "is_table": False,
            "char_count": 18,
            "token_count": 5,
            "qdrant_point_id": "point-0",
        },
        {
            "document_id": "doc-1",
            "user_id": "user-1",
            "chunk_index": 1,
            "text": "five six seven eight",
            "page_number": 2,
            "section_path": None,
            "is_table": False,
            "char_count": 20,
            "token_count": 5,
            "qdrant_point_id": "point-1",
        },
    ]
    assert repository.documents[0]["chunker_version"] == "window-v2"
    assert repository.documents[0]["embedding_model"] == "fake-model"
    assert repository.documents[0]["embedding_dimensions"] == 2
    assert [chunk["text"] for chunk in vector_store.upserted] == [
        "one two three four",
        "five six seven eight",
    ]
    assert vector_store.pruned == [("doc-1", 2)]


def test_two_arms_embed_once_each_and_share_one_upsert() -> None:
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
    miniLM = FakeEmbeddingProvider(tag=1.0)
    openai = FakeEmbeddingProvider(tag=2.0)
    processor = WorkerProcessor(
        repository=repository,
        storage=FakeStorage({"user-1/doc-1.pdf": b"document bytes"}),
        extractor=FakeExtractor(),
        embedding_arms=[
            EmbeddingArm(name="minilm", provider=miniLM),
            EmbeddingArm(name="openai", provider=openai),
        ],
        vector_store=vector_store,
        max_chunk_words=4,
        overlap_words=0,
        min_chunk_words=0,
    )

    processor.process_once()

    assert (miniLM.calls, openai.calls) == (1, 1)
    assert vector_store.embeddings == {
        "minilm": [[0.0, 1.0], [1.0, 1.0]],
        "openai": [[0.0, 2.0], [1.0, 2.0]],
    }


def test_document_fails_when_an_arm_returns_too_few_vectors() -> None:
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
        embedding_arms=[
            EmbeddingArm(name="minilm", provider=FakeEmbeddingProvider()),
            EmbeddingArm(name="openai", provider=FakeEmbeddingProvider(drop_last=True)),
        ],
        vector_store=vector_store,
        max_chunk_words=4,
        overlap_words=0,
        min_chunk_words=0,
    )

    processor.process_once()

    assert repository.documents[0]["status"] == "failed"
    assert "arm 'openai' returned 1 vectors for 2 chunks" in (
        repository.documents[0]["error_message"]
    )
    assert vector_store.embeddings == {}


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
        embedding_arms=[EmbeddingArm(name="", provider=FakeEmbeddingProvider())],
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
        embedding_arms=[EmbeddingArm(name="", provider=FakeEmbeddingProvider())],
        vector_store=FakeVectorStore(),
    )

    processed = processor.process_once()

    assert processed is True
    assert repository.documents[0]["status"] == "failed"
    assert repository.documents[0]["error_message"] == "No extractable text found"


def build_processor(
    repository: InMemoryDocumentRepository,
    extractor: Any,
    vector_store: FakeVectorStore | None = None,
) -> WorkerProcessor:
    return WorkerProcessor(
        repository=repository,
        storage=FakeStorage({"user-1/doc-1.pdf": b"document bytes"}),
        extractor=extractor,
        embedding_arms=[EmbeddingArm(name="", provider=FakeEmbeddingProvider())],
        vector_store=vector_store or FakeVectorStore(),
    )


def processing_repository() -> InMemoryDocumentRepository:
    return InMemoryDocumentRepository(
        documents=[
            {
                "id": "doc-1",
                "user_id": "user-1",
                "filename": "doc-1.pdf",
                "file_type": "pdf",
                "storage_path": "user-1/doc-1.pdf",
                "status": "processing",
            }
        ]
    )


def test_unexpected_failure_is_replaced_by_a_generic_message() -> None:
    class ExplodingExtractor:
        def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
            raise RuntimeError(
                "Client error '400 Bad Request' for url "
                "'https://projectref.supabase.co/storage/v1/object/"
                "contexta-documents/user-1/doc-1.pdf'"
            )

    repository = processing_repository()
    build_processor(repository, ExplodingExtractor()).process_once()

    message = repository.documents[0]["error_message"]
    assert message == UNEXPECTED_FAILURE_MESSAGE
    assert "supabase.co" not in message
    assert "user-1" not in message


def test_worker_written_failure_message_reaches_the_document() -> None:
    class RefusedExtractor:
        def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
            raise UserVisibleError("Stored file is no longer available")

    repository = processing_repository()
    build_processor(repository, RefusedExtractor()).process_once()

    assert repository.documents[0]["error_message"] == (
        "Stored file is no longer available"
    )


def test_document_deleted_mid_index_leaves_no_searchable_vectors() -> None:
    """Qdrant has no foreign key back to `documents`, so this is the only guard."""

    class DeletedWhileIndexing(InMemoryDocumentRepository):
        def get_document(self, document_id: str) -> Any:
            return None

    repository = DeletedWhileIndexing(documents=processing_repository().documents)
    vector_store = FakeVectorStore()

    build_processor(repository, FakeExtractor(), vector_store).process_once()

    assert vector_store.deleted == ["doc-1"]
    assert vector_store.upserted == []
    assert repository.chunks == []


def test_failed_chunk_insert_drops_the_vectors_it_just_wrote() -> None:
    class ChunkInsertRefused(InMemoryDocumentRepository):
        def replace_chunks(self, document: Any, chunks: list[Any]) -> None:
            raise RuntimeError("insert rejected")

    repository = ChunkInsertRefused(documents=processing_repository().documents)
    vector_store = FakeVectorStore()

    build_processor(repository, FakeExtractor(), vector_store).process_once()

    assert vector_store.deleted == ["doc-1"]
    assert repository.documents[0]["status"] == "failed"
