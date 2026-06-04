from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

from worker.extraction import DocumentTextExtractor
from worker.processor import WorkerProcessor
from worker.supabase import SupabaseDocumentRepository, SupabaseDocumentStorage
from worker.vector_store import DeterministicEmbeddingProvider, QdrantVectorStore


def load_env_files() -> None:
    worker_dir = Path(__file__).resolve().parents[1]
    root_dir = worker_dir.parents[1]
    for env_path in [root_dir / ".env", worker_dir / ".env"]:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip().lstrip("\ufeff"), value)


def create_processor() -> WorkerProcessor:
    supabase_url = os.environ["SUPABASE_URL"]
    service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "contexta-documents")
    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    collection_name = os.environ.get("QDRANT_COLLECTION", "contexta_chunks")
    embedding_dimensions = int(os.environ.get("EMBEDDING_DIMENSIONS", "384"))

    return WorkerProcessor(
        repository=SupabaseDocumentRepository(supabase_url, service_role_key),
        storage=SupabaseDocumentStorage(supabase_url, service_role_key, bucket),
        extractor=DocumentTextExtractor(),
        embedding_provider=DeterministicEmbeddingProvider(
            dimensions=embedding_dimensions
        ),
        vector_store=QdrantVectorStore(
            qdrant_url=qdrant_url,
            collection_name=collection_name,
            dimensions=embedding_dimensions,
        ),
    )


def run_worker(processor: WorkerProcessor, poll_interval_seconds: int = 5) -> None:
    while True:
        processed = processor.process_once()
        if not processed:
            time.sleep(poll_interval_seconds)


def main() -> None:
    load_env_files()

    parser = argparse.ArgumentParser(description="Run the Contexta document worker")
    parser.add_argument("--once", action="store_true", help="Process at most one document")
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=5,
        help="Seconds to wait between polling attempts",
    )
    args = parser.parse_args()

    processor = create_processor()
    if args.once:
        processed = processor.process_once()
        print("processed=1" if processed else "processed=0")
        return

    run_worker(processor, poll_interval_seconds=args.poll_interval)


if __name__ == "__main__":
    main()
