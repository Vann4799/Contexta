from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

try:
    from contexta_rag.embeddings import create_embedding_provider
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[3] / "packages" / "rag"
    import sys

    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import create_embedding_provider

from worker.extraction import DocumentTextExtractor
from worker.processor import WorkerProcessor
from worker.supabase import SupabaseDocumentRepository, SupabaseDocumentStorage
from worker.vector_store import QdrantVectorStore


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
    qdrant_api_key = os.environ.get("QDRANT_API_KEY", "")
    collection_name = os.environ.get("QDRANT_COLLECTION", "contexta_chunks")
    embedding_provider = os.environ.get("EMBEDDING_PROVIDER", "deterministic")
    embedding_model_name = os.environ.get("EMBEDDING_MODEL_NAME", "BAAI/bge-m3")
    embedding_device = os.environ.get("EMBEDDING_DEVICE") or None
    embedding_dimensions = int(os.environ.get("EMBEDDING_DIMENSIONS", "384"))
    embedding_remote_url = os.environ.get("EMBEDDING_REMOTE_URL", "")
    max_chunk_words = int(os.environ.get("MAX_CHUNK_WORDS", "500"))
    chunk_overlap_words = int(os.environ.get("CHUNK_OVERLAP_WORDS", "100"))
    min_chunk_words = int(os.environ.get("MIN_CHUNK_WORDS", "40"))

    return WorkerProcessor(
        repository=SupabaseDocumentRepository(supabase_url, service_role_key),
        storage=SupabaseDocumentStorage(supabase_url, service_role_key, bucket),
        extractor=DocumentTextExtractor(),
        embedding_provider=create_embedding_provider(
            provider_name=embedding_provider,
            dimensions=embedding_dimensions,
            model_name=embedding_model_name,
            device=embedding_device,
            remote_url=embedding_remote_url,
        ),
        vector_store=QdrantVectorStore(
            qdrant_url=qdrant_url,
            collection_name=collection_name,
            dimensions=embedding_dimensions,
            api_key=qdrant_api_key,
        ),
        max_chunk_words=max_chunk_words,
        overlap_words=chunk_overlap_words,
        min_chunk_words=min_chunk_words,
        index_metadata={
            "embedding_model": (
                "deterministic-hash"
                if embedding_provider in {"deterministic", "hash"}
                else embedding_model_name
            ),
            "embedding_dimensions": embedding_dimensions,
        },
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
