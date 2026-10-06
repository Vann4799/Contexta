from __future__ import annotations

import argparse
import os
import time
from pathlib import Path
from typing import NamedTuple

try:
    from contexta_rag.embeddings import create_embedding_provider, embedding_model_label
    from contexta_rag.vector_space import VectorSpace
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[3] / "packages" / "rag"
    import sys

    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import create_embedding_provider, embedding_model_label
    from contexta_rag.vector_space import VectorSpace

from worker.extraction import DocumentTextExtractor
from worker.processor import CHUNKER_VERSION, EmbeddingArm, WorkerProcessor
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


class ArmSettings(NamedTuple):
    name: str
    provider: str
    model_name: str
    dimensions: int
    device: str | None
    remote_url: str
    base_url: str
    api_key: str


def read_arm_settings(prefix: str, default_provider: str) -> ArmSettings | None:
    """Read one `<PREFIX>EMBEDDING_*` group; None when the group is not configured."""
    provider = os.environ.get(f"{prefix}EMBEDDING_PROVIDER", "") or default_provider
    if not provider:
        return None
    return ArmSettings(
        name=os.environ.get(f"{prefix}EMBEDDING_VECTOR_NAME", "").strip(),
        provider=provider,
        model_name=os.environ.get(f"{prefix}EMBEDDING_MODEL_NAME", "BAAI/bge-m3"),
        dimensions=int(os.environ.get(f"{prefix}EMBEDDING_DIMENSIONS", "384")),
        device=os.environ.get(f"{prefix}EMBEDDING_DEVICE") or None,
        remote_url=os.environ.get(f"{prefix}EMBEDDING_REMOTE_URL", ""),
        base_url=os.environ.get(f"{prefix}EMBEDDING_BASE_URL", ""),
        api_key=os.environ.get(f"{prefix}EMBEDDING_API_KEY", ""),
    )


def build_arms(settings: list[ArmSettings]) -> list[EmbeddingArm]:
    if len(settings) > 1:
        unnamed = [arm.provider for arm in settings if not arm.name]
        if unnamed:
            raise ValueError(
                "every embedding arm needs a distinct EMBEDDING_VECTOR_NAME once a "
                f"second arm is configured; missing for: {', '.join(unnamed)}"
            )
        if len({arm.name for arm in settings}) != len(settings):
            raise ValueError(
                "EMBEDDING_VECTOR_NAME values must be distinct, "
                f"got {[arm.name for arm in settings]}"
            )

    return [
        EmbeddingArm(
            name=arm.name,
            provider=create_embedding_provider(
                provider_name=arm.provider,
                dimensions=arm.dimensions,
                model_name=arm.model_name,
                device=arm.device,
                remote_url=arm.remote_url,
                base_url=arm.base_url,
                api_key=arm.api_key,
            ),
        )
        for arm in settings
    ]


def create_processor() -> WorkerProcessor:
    supabase_url = os.environ["SUPABASE_URL"]
    service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "contexta-documents")
    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.environ.get("QDRANT_API_KEY", "")
    collection_name = os.environ.get("QDRANT_COLLECTION", "contexta_chunks")
    max_chunk_words = int(os.environ.get("MAX_CHUNK_WORDS", "500"))
    chunk_overlap_words = int(os.environ.get("CHUNK_OVERLAP_WORDS", "100"))
    min_chunk_words = int(os.environ.get("MIN_CHUNK_WORDS", "40"))

    arm_settings = [
        arm
        for arm in [
            read_arm_settings("", "deterministic"),
            read_arm_settings("SECONDARY_", ""),
        ]
        if arm
    ]
    arms = build_arms(arm_settings)
    spaces = [
        VectorSpace(
            name=arm.name,
            dimensions=settings.dimensions,
            model_label=embedding_model_label(settings.provider, settings.model_name),
        )
        for arm, settings in zip(arms, arm_settings)
    ]
    primary = spaces[0]

    index_metadata = {
        "chunker_version": CHUNKER_VERSION,
        "embedding_model": primary.model_label,
        "embedding_dimensions": primary.dimensions,
    }
    # Qdrant may hold several vector spaces in one point, so the payload records
    # a per-slot label map that the vector-space guard can read back. Postgres
    # has no such column, so the map stays out of index_metadata.
    payload_metadata = dict(index_metadata)
    if len(spaces) > 1:
        payload_metadata["embedding_models"] = {
            space.name: space.model_label for space in spaces
        }

    return WorkerProcessor(
        repository=SupabaseDocumentRepository(supabase_url, service_role_key),
        storage=SupabaseDocumentStorage(supabase_url, service_role_key, bucket),
        extractor=DocumentTextExtractor(),
        embedding_arms=arms,
        vector_store=QdrantVectorStore(
            qdrant_url=qdrant_url,
            collection_name=collection_name,
            vectors=spaces,
            api_key=qdrant_api_key,
            index_metadata=payload_metadata,
        ),
        max_chunk_words=max_chunk_words,
        overlap_words=chunk_overlap_words,
        min_chunk_words=min_chunk_words,
        index_metadata=index_metadata,
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
