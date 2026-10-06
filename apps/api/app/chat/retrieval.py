from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import TYPE_CHECKING, NamedTuple, Protocol

import httpx

from app.chat.models import RetrievedContext

try:
    from contexta_rag.embeddings import create_embedding_provider, embedding_model_label
    from contexta_rag.fusion import order_by_fusion, reciprocal_rank_fusion
    from contexta_rag.vector_space import VectorSpace, assert_vector_spaces_match
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import create_embedding_provider, embedding_model_label
    from contexta_rag.fusion import order_by_fusion, reciprocal_rank_fusion
    from contexta_rag.vector_space import VectorSpace, assert_vector_spaces_match

if TYPE_CHECKING:
    from app.core.config import Settings


class EmbeddingProvider(Protocol):
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


class RetrievalArm(NamedTuple):
    """One embedder, the Qdrant vector slot it reads, and how to describe it."""

    name: str
    provider: EmbeddingProvider
    dimensions: int
    model_label: str


class QdrantRetriever:
    def __init__(
        self,
        qdrant_url: str,
        collection_name: str,
        arms: list[RetrievalArm],
        api_key: str = "",
        client: httpx.Client | None = None,
    ) -> None:
        if not arms:
            raise ValueError("at least one retrieval arm is required")
        self._qdrant_url = qdrant_url.rstrip("/")
        self._collection_name = collection_name
        self._arms = arms
        self._headers = {"api-key": api_key} if api_key else None
        self._client = client or httpx.Client(timeout=30)
        self._vector_space_checked = False

    def _ensure_vector_space(self) -> None:
        if self._vector_space_checked:
            return
        assert_vector_spaces_match(
            client=self._client,
            qdrant_url=self._qdrant_url,
            collection_name=self._collection_name,
            spaces=[
                VectorSpace(
                    name=arm.name,
                    dimensions=arm.dimensions,
                    model_label=arm.model_label,
                )
                for arm in self._arms
            ],
            headers=self._headers,
        )
        self._vector_space_checked = True

    def retrieve(
        self,
        user_id: str,
        question: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
        doc_types: list[str] | None = None,
    ) -> list[RetrievedContext]:
        self._ensure_vector_space()
        must_filters: list[dict[str, object]] = [
            {"key": "user_id", "match": {"value": user_id}}
        ]
        if document_ids:
            must_filters.append(
                {"key": "document_id", "match": {"any": document_ids}}
            )
        if doc_types:
            must_filters.append({"key": "doc_type", "match": {"any": doc_types}})

        if len(self._arms) == 1:
            ranked_points = [self._search(self._arms[0], question, must_filters, top_k)]
        else:
            # Two arms are one local model call plus one remote one; running them
            # concurrently keeps query latency at the slower arm instead of the sum.
            # An arm that fails raises out of this call rather than quietly dropping
            # to one retriever, because a half-dead hybrid index looks identical to
            # a working one in the answer text.
            with ThreadPoolExecutor(max_workers=len(self._arms)) as pool:
                ranked_points = list(
                    pool.map(
                        lambda arm: self._search(arm, question, must_filters, top_k),
                        self._arms,
                    )
                )

        return self._fuse(ranked_points, top_k)

    def _search(
        self,
        arm: RetrievalArm,
        question: str,
        must_filters: list[dict[str, object]],
        limit: int,
    ) -> list[dict[str, object]]:
        query_vector = arm.provider.embed_texts([question])[0]
        response = self._client.post(
            f"{self._qdrant_url}/collections/{self._collection_name}/points/search",
            headers=self._headers,
            json={
                "vector": (
                    {"name": arm.name, "vector": query_vector}
                    if arm.name
                    else query_vector
                ),
                "limit": limit,
                "with_payload": True,
                "filter": {"must": must_filters},
            },
        )
        response.raise_for_status()
        points = response.json().get("result", [])
        return [point for point in points if isinstance(point, dict)]

    def _fuse(
        self,
        ranked_points: list[list[dict[str, object]]],
        top_k: int,
    ) -> list[RetrievedContext]:
        """Merge the arms by rank position, never by raw score.

        Each arm scores in its own cosine space, so a 0.81 from one model is not
        comparable to 0.81 from another; only the ordering inside an arm is
        trusted. A point found by both arms therefore outranks a point one arm
        liked very much, and the best cosine is kept only as a display score.
        """
        points_by_id: dict[str, dict[str, object]] = {}
        rankings: list[list[str]] = []
        for points in ranked_points:
            keys: list[str] = []
            for point in points:
                key = str(point["id"])
                keys.append(key)
                previous = points_by_id.get(key)
                if previous is None or _score(point) > _score(previous):
                    points_by_id[key] = point
            rankings.append(keys)

        ordered = order_by_fusion(reciprocal_rank_fusion(rankings))[:top_k]
        return [self._context(points_by_id[key]) for key in ordered]

    def _context(self, point: dict[str, object]) -> RetrievedContext:
        payload = point["payload"]
        assert isinstance(payload, dict)
        return {
            "document_id": payload["document_id"],
            "document_name": payload.get("filename", "Unknown document"),
            "doc_type": payload.get("doc_type", "unclassified"),
            "chunk_index": payload["chunk_index"],
            "page_number": payload.get("page_number"),
            "section_path": payload.get("section_path"),
            "text": payload["text"],
            "score": float(point["score"]),
        }


def _score(point: dict[str, object]) -> float:
    return float(point["score"])


def retriever_from_settings(settings: Settings) -> QdrantRetriever:
    """Build the production retriever, including any configured second arm.

    The eval harness calls this too, so a measured number always describes the
    path that serves real questions.
    """
    arms = [
        _arm(
            name=settings.embedding_vector_name,
            provider_name=settings.embedding_provider,
            model_name=settings.embedding_model_name,
            dimensions=settings.embedding_dimensions,
            device=settings.embedding_device or None,
            remote_url=settings.embedding_remote_url,
            base_url=settings.embedding_base_url,
            api_key=settings.embedding_api_key,
        )
    ]
    if settings.secondary_embedding_provider:
        arms.append(
            _arm(
                name=settings.secondary_embedding_vector_name,
                provider_name=settings.secondary_embedding_provider,
                model_name=settings.secondary_embedding_model_name,
                dimensions=settings.secondary_embedding_dimensions,
                device="",
                remote_url=settings.secondary_embedding_remote_url,
                base_url=settings.secondary_embedding_base_url,
                api_key=settings.secondary_embedding_api_key,
            )
        )

    if len(arms) > 1 and any(not arm.name for arm in arms):
        raise ValueError(
            "every embedding arm needs a distinct EMBEDDING_VECTOR_NAME once a second "
            "arm is configured"
        )

    return QdrantRetriever(
        qdrant_url=settings.qdrant_url,
        collection_name=settings.qdrant_collection,
        arms=arms,
        api_key=settings.qdrant_api_key,
    )


def _arm(
    *,
    name: str,
    provider_name: str,
    model_name: str,
    dimensions: int,
    device: str | None,
    remote_url: str,
    base_url: str,
    api_key: str,
) -> RetrievalArm:
    return RetrievalArm(
        name=name,
        provider=create_embedding_provider(
            provider_name=provider_name,
            dimensions=dimensions,
            model_name=model_name,
            device=device,
            remote_url=remote_url,
            base_url=base_url,
            api_key=api_key,
        ),
        dimensions=dimensions,
        model_label=embedding_model_label(provider_name, model_name),
    )
