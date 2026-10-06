from __future__ import annotations

import json
from uuid import UUID

import httpx
import pytest

from contexta_rag.vector_space import VectorSpace, reset_vector_space_cache
from worker.vector_store import DeterministicEmbeddingProvider, QdrantVectorStore


def space(name: str = "", dimensions: int = 2, model_label: str = "miniLM") -> VectorSpace:
    return VectorSpace(name=name, dimensions=dimensions, model_label=model_label)


@pytest.fixture(autouse=True)
def clear_vector_space_cache() -> None:
    reset_vector_space_cache()


def test_deterministic_embedding_provider_returns_stable_vectors() -> None:
    provider = DeterministicEmbeddingProvider(dimensions=8)

    first = provider.embed_texts(["alpha beta"])[0]
    second = provider.embed_texts(["alpha beta"])[0]

    assert first == second
    assert len(first) == 8
    assert any(value != 0 for value in first)


def test_qdrant_vector_store_creates_collection_and_upserts_chunks() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.method == "GET":
            return httpx.Response(404)
        if request.method in {"PUT", "POST"}:
            return httpx.Response(200, json={"result": "ok"})
        raise AssertionError(f"Unexpected request {request.method}")

    store = QdrantVectorStore(
        qdrant_url="http://qdrant.local",
        collection_name="contexta_chunks",
        vectors=[space()],
        api_key="qdrant-key",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    point_ids = store.upsert_chunks(
        document={
            "id": "doc-1",
            "user_id": "user-1",
            "filename": "file.pdf",
            "doc_type": "sop",
            "status": "processing",
        },
        chunks=[
            {
                "document_id": "doc-1",
                "user_id": "user-1",
                "chunk_index": 0,
                "text": "hello",
                "page_number": 1,
                "section_path": "2. Procedure",
                "is_table": True,
                "qdrant_point_id": "",
            }
        ],
        embeddings={"": [[0.1, 0.2]]},
    )

    UUID(point_ids[0])
    assert [request.method for request in requests] == [
        "GET",
        "PUT",
        "PUT",
        "PUT",
        "PUT",
        "PUT",
        "PUT",
    ]
    assert json.loads(requests[1].content) == {
        "vectors": {"size": 2, "distance": "Cosine"}
    }
    assert all(request.headers["api-key"] == "qdrant-key" for request in requests)
    assert [
        json.loads(request.content)["field_name"] for request in requests[2:6]
    ] == ["user_id", "document_id", "doc_type", "page_number"]

    upsert_payload = json.loads(requests[6].content)
    assert upsert_payload["points"][0]["id"] == point_ids[0]
    assert upsert_payload["points"][0]["vector"] == [0.1, 0.2]
    assert upsert_payload["points"][0]["payload"] == {
        "document_id": "doc-1",
        "user_id": "user-1",
        "filename": "file.pdf",
        "doc_type": "sop",
        "doc_version": None,
        "chunk_index": 0,
        "text": "hello",
        "page_number": 1,
        "section_path": "2. Procedure",
        "is_table": True,
    }


def test_qdrant_vector_store_indexes_payload_on_an_existing_collection() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"result": "ok"})

    store = QdrantVectorStore(
        qdrant_url="http://qdrant.local",
        collection_name="contexta_chunks",
        vectors=[space()],
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    store.upsert_chunks(
        document={"id": "doc-1", "user_id": "user-1", "filename": "file.pdf"},
        chunks=[
            {
                "document_id": "doc-1",
                "user_id": "user-1",
                "chunk_index": 0,
                "text": "hello",
                "page_number": 1,
                "section_path": None,
                "is_table": False,
                "qdrant_point_id": "",
            }
        ],
        embeddings={"": [[0.1, 0.2]]},
    )

    collection_exists = requests[0]
    assert collection_exists.method == "GET"
    indexed_fields = [
        json.loads(request.content)["field_name"]
        for request in requests
        if request.url.path.endswith("/index")
    ]
    assert indexed_fields == ["user_id", "document_id", "doc_type", "page_number"]
    assert json.loads(requests[-1].content)["points"][0]["payload"]["doc_type"] == (
        "unclassified"
    )


def build_store(
    handler,
    requests: list[httpx.Request],
    **kwargs: object,
) -> QdrantVectorStore:
    def record(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return handler(request)

    kwargs.setdefault("vectors", [space()])
    return QdrantVectorStore(
        qdrant_url="http://qdrant.local",
        collection_name="contexta_chunks_v2",
        client=httpx.Client(transport=httpx.MockTransport(record)),
        **kwargs,  # type: ignore[arg-type]
    )


def upsert_one(
    store: QdrantVectorStore,
    embeddings: dict[str, list[list[float]]] | None = None,
) -> None:
    store.upsert_chunks(
        document={"id": "doc-1", "user_id": "user-1", "filename": "file.pdf"},
        chunks=[
            {
                "document_id": "doc-1",
                "user_id": "user-1",
                "chunk_index": 0,
                "text": "hello",
                "page_number": 1,
                "section_path": None,
                "is_table": False,
                "qdrant_point_id": "",
            }
        ],
        embeddings=embeddings if embeddings is not None else {"": [[0.1, 0.2]]},
    )


def test_upsert_records_the_index_metadata_in_every_payload() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/scroll"):
            return httpx.Response(200, json={"result": {"points": []}})
        return httpx.Response(
            200,
            json={"result": {"config": {"params": {"vectors": {"size": 2}}}}},
        )

    store = build_store(
        handler,
        requests,
        index_metadata={
            "chunker_version": "window-v2",
            "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2",
            "embedding_dimensions": 2,
        },
    )

    upsert_one(store)

    payload = json.loads(requests[-1].content)["points"][0]["payload"]
    assert payload["chunker_version"] == "window-v2"
    assert payload["embedding_model"] == "paraphrase-multilingual-MiniLM-L12-v2"
    assert payload["embedding_dimensions"] == 2


def test_upsert_refuses_a_collection_indexed_by_another_model() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/scroll"):
            return httpx.Response(
                200,
                json={"result": {"points": [{"payload": {"embedding_model": "bge-m3"}}]}},
            )
        return httpx.Response(
            200,
            json={"result": {"config": {"params": {"vectors": {"size": 2}}}}},
        )

    store = build_store(
        handler,
        requests,
        index_metadata={"embedding_model": "paraphrase-multilingual-MiniLM-L12-v2"},
    )

    with pytest.raises(RuntimeError, match="indexed with 'bge-m3'"):
        upsert_one(store)

    assert [request.method for request in requests] == ["GET", "POST"]


def test_upsert_refuses_a_collection_of_another_dimensionality() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"result": {"config": {"params": {"vectors": {"size": 1024}}}}},
        )

    store = build_store(handler, requests, index_metadata={"embedding_model": "miniLM"})

    with pytest.raises(RuntimeError, match="stores 1024-dimension vectors"):
        upsert_one(store)

    assert [request.method for request in requests] == ["GET"]


def test_two_vector_slots_create_a_named_collection_and_one_shared_point() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(404)
        return httpx.Response(200, json={"result": "ok"})

    store = build_store(
        handler,
        requests,
        vectors=[space("minilm"), space("openai", dimensions=4)],
        index_metadata={
            "embedding_model": "miniLM",
            "embedding_models": {"minilm": "miniLM", "openai": "3-small"},
        },
    )

    upsert_one(store, {"minilm": [[0.1, 0.2]], "openai": [[0.3, 0.4, 0.5, 0.6]]})

    create_request = requests[1]
    assert create_request.url.path == "/collections/contexta_chunks_v2"
    assert json.loads(create_request.content) == {
        "vectors": {
            "minilm": {"size": 2, "distance": "Cosine"},
            "openai": {"size": 4, "distance": "Cosine"},
        }
    }

    point = json.loads(requests[-1].content)["points"][0]
    assert point["vector"] == {"minilm": [0.1, 0.2], "openai": [0.3, 0.4, 0.5, 0.6]}
    assert point["payload"]["embedding_models"] == {
        "minilm": "miniLM",
        "openai": "3-small",
    }


def test_upsert_refuses_when_an_arm_supplied_no_embeddings() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(404)
        return httpx.Response(200, json={"result": "ok"})

    store = build_store(
        handler,
        requests,
        vectors=[space("minilm"), space("openai", dimensions=4)],
    )

    with pytest.raises(
        ValueError, match="no embeddings supplied for vector slot\\(s\\): openai"
    ):
        upsert_one(store, {"minilm": [[0.1, 0.2]]})

    assert requests == []


def test_prune_stale_chunks_deletes_only_the_leftover_chunk_indices() -> None:
    requests: list[httpx.Request] = []
    store = build_store(lambda _request: httpx.Response(200, json={"result": "ok"}), requests)

    store.prune_stale_chunks("doc-1", 75)

    delete_request = requests[0]
    assert delete_request.method == "POST"
    assert delete_request.url.path == "/collections/contexta_chunks_v2/points/delete"
    assert delete_request.url.params["wait"] == "true"
    assert json.loads(delete_request.content)["filter"]["must"] == [
        {"key": "document_id", "match": {"value": "doc-1"}},
        {"key": "chunk_index", "range": {"gte": 75}},
    ]


def test_prune_stale_chunks_skips_qdrant_without_a_known_chunk_count() -> None:
    requests: list[httpx.Request] = []
    store = build_store(lambda _request: httpx.Response(200, json={"result": "ok"}), requests)

    store.prune_stale_chunks("doc-1", 0)

    assert requests == []
