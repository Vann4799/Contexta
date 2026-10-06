from __future__ import annotations

import json
from uuid import UUID

import httpx

from worker.vector_store import DeterministicEmbeddingProvider, QdrantVectorStore


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
        dimensions=2,
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
        embeddings=[[0.1, 0.2]],
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
    assert all(request.headers["api-key"] == "qdrant-key" for request in requests)
    assert [
        json.loads(request.content)["field_name"] for request in requests[2:6]
    ] == ["user_id", "document_id", "doc_type", "page_number"]

    upsert_payload = json.loads(requests[6].content)
    assert upsert_payload["points"][0]["id"] == point_ids[0]
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
        dimensions=2,
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
        embeddings=[[0.1, 0.2]],
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
