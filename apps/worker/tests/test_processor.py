from worker.processor import InMemoryDocumentRepository, WorkerProcessor


def test_process_once_marks_processing_document_ready() -> None:
    repository = InMemoryDocumentRepository(
        [
            {
                "id": "doc-1",
                "filename": "contract.pdf",
                "status": "processing",
            }
        ]
    )
    processor = WorkerProcessor(repository)

    processed = processor.process_once()

    assert processed is True
    assert repository.documents[0]["status"] == "ready"


def test_process_once_returns_false_when_no_document_available() -> None:
    repository = InMemoryDocumentRepository([])
    processor = WorkerProcessor(repository)

    processed = processor.process_once()

    assert processed is False
