from __future__ import annotations

import pytest

from worker.processor import EmbeddingArm, InMemoryDocumentRepository, WorkerProcessor
from worker.reindex import collect_documents, run_reindex


class FakeStorage:
    def __init__(self, objects: dict[str, bytes]) -> None:
        self.objects = objects

    def download_document(self, storage_path: str) -> bytes:
        return self.objects[storage_path]


class FakeExtractor:
    def extract(self, content: bytes, file_type: str) -> dict:
        return {"pages": [{"page_number": 1, "text": "satu dua tiga"}]}


class FakeEmbeddingProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[0.1, 0.2] for _ in texts]


class FakeVectorStore:
    def __init__(self) -> None:
        self.upserted_chunks = 0
        self.pruned: list[tuple[str, int]] = []
        self.deleted: list[str] = []

    def upsert_chunks(
        self,
        document: dict,
        chunks: list[dict],
        embeddings: dict[str, list[list[float]]],
    ) -> list[str]:
        self.upserted_chunks += len(chunks)
        return [f"point-{chunk['chunk_index']}" for chunk in chunks]

    def prune_stale_chunks(self, document_id: str, chunk_count: int) -> None:
        self.pruned.append((document_id, chunk_count))

    def delete_document_vectors(self, document_id: str) -> None:
        self.deleted.append(document_id)


def ready_document(document_id: str, **extra: object) -> dict:
    document = {
        "id": document_id,
        "user_id": "user-1",
        "filename": f"{document_id}.pdf",
        "file_type": "pdf",
        "storage_path": f"user-1/{document_id}.pdf",
        "status": "ready",
    }
    document.update(extra)  # type: ignore[arg-type]
    return document


def build_processor(documents: list[dict]) -> WorkerProcessor:
    vector_store = FakeVectorStore()
    processor = WorkerProcessor(
        repository=InMemoryDocumentRepository(documents),
        storage=FakeStorage(
            {f"user-1/{document['id']}.pdf": b"document bytes" for document in documents}
        ),
        extractor=FakeExtractor(),
        embedding_arms=[EmbeddingArm(name="", provider=FakeEmbeddingProvider())],
        vector_store=vector_store,
        index_metadata={"embedding_model": "miniLM", "embedding_dimensions": 2},
    )
    return processor


def test_reindex_rewrites_every_document_and_prunes_leftover_points() -> None:
    documents = [ready_document("doc-1"), ready_document("doc-2")]
    processor = build_processor(documents)

    indexed, failed, skipped = run_reindex(processor, collect_documents(processor, None))

    assert (indexed, failed, skipped) == (2, 0, 0)
    assert processor.vector_store.upserted_chunks == 2
    assert processor.vector_store.pruned == [("doc-1", 1), ("doc-2", 1)]
    assert [document["embedding_model"] for document in documents] == ["miniLM", "miniLM"]
    assert [document["chunker_version"] for document in documents] == ["window-v2", "window-v2"]


def test_reindex_targets_a_single_document() -> None:
    processor = build_processor([ready_document("doc-1"), ready_document("doc-2")])

    documents = collect_documents(processor, "doc-2")

    assert [document["id"] for document in documents] == ["doc-2"]


def test_reindex_skips_documents_the_worker_has_claimed() -> None:
    documents = [ready_document("doc-1"), ready_document("doc-2", status="processing")]
    processor = build_processor(documents)

    indexed, failed, skipped = run_reindex(processor, collect_documents(processor, None))

    assert (indexed, failed, skipped) == (1, 0, 1)
    assert "chunker_version" not in documents[1]


def test_reindex_leaves_a_failing_document_ready_on_its_previous_index(capsys) -> None:
    documents = [
        ready_document("doc-1", filename="doc-1.txt", file_type="txt"),
        ready_document("doc-2"),
    ]
    processor = build_processor(documents)

    indexed, failed, skipped = run_reindex(processor, documents)

    assert (indexed, failed, skipped) == (1, 1, 0)
    assert documents[0]["status"] == "ready"
    assert "Unsupported document type" in capsys.readouterr().err


def test_collect_documents_rejects_an_unknown_id() -> None:
    processor = build_processor([ready_document("doc-1")])

    with pytest.raises(ValueError, match="document not found: doc-9"):
        collect_documents(processor, "doc-9")
