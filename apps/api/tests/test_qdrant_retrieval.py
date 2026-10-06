import json

import httpx

from app.chat.retrieval import QdrantRetriever


class FakeEmbeddingProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[0.1, 0.2] for _ in texts]


def build_retriever(requests: list[httpx.Request]) -> QdrantRetriever:
    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
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

    return QdrantRetriever(
        qdrant_url="http://qdrant.local",
        collection_name="contexta_chunks",
        embedding_provider=FakeEmbeddingProvider(),
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def test_retrieve_maps_payload_metadata_into_context() -> None:
    requests: list[httpx.Request] = []

    contexts = build_retriever(requests).retrieve("user-1", "how do I restart")

    body = json.loads(requests[0].content)
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

    must = json.loads(requests[0].content)["filter"]["must"]
    assert must == [
        {"key": "user_id", "match": {"value": "user-1"}},
        {"key": "document_id", "match": {"any": ["doc-1"]}},
        {"key": "doc_type", "match": {"any": ["sop", "policy"]}},
    ]
