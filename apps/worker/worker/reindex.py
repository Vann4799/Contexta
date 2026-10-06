from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from worker.main import create_processor, load_env_files
from worker.processor import ProcessingDocument, WorkerProcessor

# The poll loop owns documents it has claimed, so reindexing them would race it.
CLAIMED_STATUS = "processing"


def collect_documents(
    processor: WorkerProcessor,
    document_id: str | None,
) -> list[ProcessingDocument]:
    if document_id:
        document = processor.repository.get_document(document_id)
        if document is None:
            raise ValueError(f"document not found: {document_id}")
        return [document]
    return processor.repository.list_documents()


def run_reindex(
    processor: WorkerProcessor,
    documents: Sequence[ProcessingDocument],
) -> tuple[int, int, int]:
    indexed = failed = skipped = 0

    for document in documents:
        document_id = document.get("id", "")
        if document.get("status") == CLAIMED_STATUS:
            skipped += 1
            print(f"skipped {document_id}: the worker is processing it", file=sys.stderr)
            continue

        try:
            chunk_count = processor.process_document(document)
        except Exception as exc:
            failed += 1
            print(
                f"failed {document_id} {document.get('filename', '')}: {exc}",
                file=sys.stderr,
            )
            continue

        indexed += 1
        print(f"reindexed {document_id} chunks={chunk_count}")

    return indexed, failed, skipped


def main(argv: Sequence[str] | None = None) -> None:
    load_env_files()

    parser = argparse.ArgumentParser(
        description="Re-extract and re-index documents with the current chunker and embedding model",
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--all", action="store_true", help="Reindex every document")
    target.add_argument("--document-id", help="Reindex one document by id")
    args = parser.parse_args(argv)

    processor = create_processor()
    try:
        documents = collect_documents(processor, args.document_id)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2) from exc

    if not documents:
        print("no documents to reindex")
        return

    indexed, failed, skipped = run_reindex(processor, documents)
    print(f"reindexed={indexed} failed={failed} skipped={skipped}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
