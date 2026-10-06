import json

import httpx
import pytest

from app.chat.retrieval import QdrantRetriever
from contexta_rag.vector_space import reset_vector_space_cache

COLLECTION = "contexta_chunks"
SEARCH_PATH = f"/collections/{COLLECTION}/points/search"


class FakeEmbeddingProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[0.1, 0.2] for _ in texts]


@pytest.fixture(autouse=True)
def clear_vector_space_cache() -> None:
    reset_vector_space_cache()


def handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/points/search"):
        return httpx.Response(
            200,
            json={
                "result": [
                    {
                        "id": "point-1",
                        "score": 0.82,
                        "payload": {
                            "document_id": "doc-1",
                            "user_id": "user-1",
                            "filename": "runbook.pdf",
                            "doc_type": "sop",
                            "chunk_index": 3,
                            "page_number": 7,
                            "section_path": "4. Steps",
                            "text": "restart the worker",
                        },
                    }
                ]
            },
        )
    if request.url.path.endswith("/points/scroll"):
        return httpx.Response(200, json={"result": {"points": []}})
    return httpx.Response(
        200,
        json={"result": {"config": {"params": {"vectors": {"size": 2}}}}},
    )


def build_retriever(requests: list[httpx.Request]) -> QdrantRetriever:
    def record(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return handler(request)

    return QdrantRetriever(
        qdrant_url="http://qdrant.local",
        collection_name=COLLECTION,
        embedding_provider=FakeEmbeddingProvider(),
        expected_dimensions=2,
        expected_model_label="deterministic-hash",
        client=httpx.Client(transport=httpx.MockTransport(record)),
    )


def search_request(requests: list[httpx.Request]) -> dict:
    searches = [request for request in requests if request.url.path == SEARCH_PATH]
    assert len(searches) == 1
    return json.loads(searches[0].content)


def test_retrieve_maps_payload_metadata_into_context() -> None:
    requests: list[httpx.Request] = []

    contexts = build_retriever(requests).retrieve("user-1", "how do I restart")

    body = search_request(requests)
    assert body["vector"] == [0.1, 0.2]
    assert body["filter"] == {"must": [{"key": "user_id", "match": {"value": "user-1"}}]}
    assert contexts == [
        {
            "document_id": "doc-1",
            "document_name": "runbook.pdf",
            "doc_type": "sop",
            "chunk_index": 3,
            "page_number": 7,
            "section_path": "4. Steps",
            "text": "restart the worker",
            "score": 0.82,
        }
    ]


def test_retrieve_filters_by_document_types() -> None:
    requests: list[httpx.Request] = []

    build_retriever(requests).retrieve(
        "user-1",
        "how do I restart",
        document_ids=["doc-1"],
        doc_types=["sop", "policy"],
    )

    must = search_request(requests)["filter"]["must"]
    assert must == [
        {"key": "user_id", "match": {"value": "user-1"}},
        {"key": "document_id", "match": {"any": ["doc-1"]}},
        {"key": "doc_type", "match": {"any": ["sop", "policy"]}},
    ]


def test_retrieve_checks_the_vector_space_once_then_caches_it() -> None:
    requests: list[httpx.Request] = []
    retriever = build_retriever(requests)

    retriever.retrieve("user-1", "how do I restart")
    retriever.retrieve("user-1", "what next")

    verified = [
        request
        for request in requests
        if request.url.path in {f"/collections/{COLLECTION}", f"/collections/{COLLECTION}/points/scroll"}
    ]
    assert [request.method for request in verified] == ["GET", "POST"]
    assert len([request for request in requests if request.url.path == SEARCH_PATH]) == 2


def test_retrieve_refuses_a_collection_of_another_dimensionality() -> None:
    def mismatched(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/search"):
            raise AssertionError("search must not run against a mismatched collection")
        return httpx.Response(
            200,
            json={"result": {"config": {"params": {"vectors": {"size": 1024}}}}},
        )

    retriever = QdrantRetriever(
        qdrant_url="http://qdrant.local",
        collection_name=COLLECTION,
        embedding_provider=FakeEmbeddingProvider(),
        expected_dimensions=2,
        expected_model_label="deterministic-hash",
        client=httpx.Client(transport=httpx.MockTransport(mismatched)),
    )

    with pytest.raises(RuntimeError, match="stores 1024-dimension vectors"):
        retriever.retrieve("user-1", "how do I restart")


def test_retrieve_refuses_a_same_size_collection_from_another_model() -> None:
    def mismatched(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/scroll"):
            return httpx.Response(
                200,
                json={"result": {"points": [{"payload": {"embedding_model": "bge-m3"}}]}},
            )
        if request.url.path.endswith("/points/search"):
            raise AssertionError("search must not run against a mismatched collection")
        return httpx.Response(
            200,
            json={"result": {"config": {"params": {"vectors": {"size": 2}}}}},
        )

    retriever = QdrantRetriever(
        qdrant_url="http://qdrant.local",
        collection_name=COLLECTION,
        embedding_provider=FakeEmbeddingProvider(),
        expected_dimensions=2,
        expected_model_label="paraphrase-multilingual-MiniLM-L12-v2",
        client=httpx.Client(transport=httpx.MockTransport(mismatched)),
    )

    with pytest.raises(RuntimeError, match="indexed with 'bge-m3'"):
        retriever.retrieve("user-1", "how do I restart")
