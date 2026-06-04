from __future__ import annotations

import json

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
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    point_ids = store.upsert_chunks(
        document={
            "id": "doc-1",
            "user_id": "user-1",
            "filename": "file.pdf",
            "status": "processing",
        },
        chunks=[
            {
                "document_id": "doc-1",
                "user_id": "user-1",
                "chunk_index": 0,
                "text": "hello",
                "page_number": 1,
                "qdrant_point_id": "",
            }
        ],
        embeddings=[[0.1, 0.2]],
    )

    assert point_ids == ["doc-1-0"]
    assert [request.method for request in requests] == ["GET", "PUT", "PUT"]
    upsert_payload = json.loads(requests[2].content)
    assert upsert_payload["points"][0]["id"] == "doc-1-0"
    assert upsert_payload["points"][0]["payload"]["text"] == "hello"
