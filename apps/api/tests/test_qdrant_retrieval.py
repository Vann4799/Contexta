import json

import httpx
import pytest

from app.chat.retrieval import QdrantRetriever, RetrievalArm, retriever_from_settings
from app.core.config import Settings
from contexta_rag.vector_space import reset_vector_space_cache

COLLECTION = "contexta_chunks"
SEARCH_PATH = f"/collections/{COLLECTION}/points/search"


class FakeEmbeddingProvider:
    def __init__(self, tag: float = 0.2) -> None:
        self.tag = tag

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[0.1, self.tag] for _ in texts]


def arm(
    name: str = "",
    tag: float = 0.2,
    dimensions: int = 2,
    model_label: str = "deterministic-hash",
) -> RetrievalArm:
    return RetrievalArm(
        name=name,
        provider=FakeEmbeddingProvider(tag),
        dimensions=dimensions,
        model_label=model_label,
    )


@pytest.fixture(autouse=True)
def clear_vector_space_cache() -> None:
    reset_vector_space_cache()


def point(point_id: str, document_id: str, chunk_index: int, score: float) -> dict:
    return {
        "id": point_id,
        "score": score,
        "payload": {
            "document_id": document_id,
            "user_id": "user-1",
            "filename": "runbook.pdf",
            "doc_type": "sop",
            "chunk_index": chunk_index,
            "page_number": 7,
            "section_path": "4. Steps",
            "text": "restart the worker",
        },
    }


def handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/points/search"):
        return httpx.Response(
            200,
            json={"result": [point("point-1", "doc-1", 3, 0.82)]},
        )
    if request.url.path.endswith("/points/scroll"):
        return httpx.Response(200, json={"result": {"points": []}})
    return httpx.Response(
        200,
        json={"result": {"config": {"params": {"vectors": {"size": 2}}}}},
    )


def build_retriever(
    requests: list[httpx.Request],
    arms: list[RetrievalArm] | None = None,
    response_handler=handler,
    arm_window: int = 10,
) -> QdrantRetriever:
    def record(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return response_handler(request)

    return QdrantRetriever(
        qdrant_url="http://qdrant.local",
        collection_name=COLLECTION,
        arms=arms if arms is not None else [arm()],
        client=httpx.Client(transport=httpx.MockTransport(record)),
        arm_window=arm_window,
    )


def search_bodies(requests: list[httpx.Request]) -> list[dict]:
    return [
        json.loads(request.content)
        for request in requests
        if request.url.path == SEARCH_PATH
    ]


def search_body(requests: list[httpx.Request]) -> dict:
    bodies = search_bodies(requests)
    assert len(bodies) == 1
    return bodies[0]


def test_retrieve_maps_payload_metadata_into_context() -> None:
    requests: list[httpx.Request] = []

    contexts = build_retriever(requests).retrieve("user-1", "how do I restart")

    body = search_body(requests)
    assert body["vector"] == [0.1, 0.2]
    assert (
        body["filter"]
        == {"must": [{"key": "user_id", "match": {"value": "user-1"}}]}
    )
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

    must = search_body(requests)["filter"]["must"]
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
        if request.url.path
        in {
            f"/collections/{COLLECTION}",
            f"/collections/{COLLECTION}/points/scroll",
        }
    ]
    assert [request.method for request in verified] == ["GET", "POST"]
    assert len(search_bodies(requests)) == 2


def test_a_named_arm_searches_its_own_vector_slot() -> None:
    requests: list[httpx.Request] = []

    def named(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/scroll"):
            return httpx.Response(200, json={"result": {"points": []}})
        if request.url.path.endswith("/points/search"):
            return httpx.Response(200, json={"result": []})
        return httpx.Response(
            200,
            json={
                "result": {
                    "config": {"params": {"vectors": {"openai": {"size": 2}}}}
                }
            },
        )

    build_retriever(requests, arms=[arm(name="openai")], response_handler=named).retrieve(
        "user-1",
        "how do I restart",
    )

    assert search_body(requests)["vector"] == {"name": "openai", "vector": [0.1, 0.2]}


def two_arm_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/points/scroll"):
        return httpx.Response(200, json={"result": {"points": []}})
    if request.url.path.endswith("/points/search"):
        slot = json.loads(request.content)["vector"]
        slot_name = slot["name"] if isinstance(slot, dict) else ""
        if slot_name == "minilm":
            return httpx.Response(
                200,
                json={
                    "result": [
                        point("p1", "doc-1", 0, 0.70),
                        point("p2", "doc-2", 1, 0.60),
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "result": [
                    point("p2", "doc-2", 1, 0.90),
                    point("p3", "doc-3", 2, 0.50),
                ]
            },
        )
    return httpx.Response(
        200,
        json={
            "result": {
                "config": {
                    "params": {
                        "vectors": {
                            "minilm": {"size": 2},
                            "openai": {"size": 2},
                        }
                    }
                }
            }
        },
    )


def test_two_arms_merge_by_rank_not_by_raw_score() -> None:
    requests: list[httpx.Request] = []
    retriever = build_retriever(
        requests,
        arms=[arm(name="minilm"), arm(name="openai", tag=0.9)],
        response_handler=two_arm_handler,
    )

    contexts = retriever.retrieve("user-1", "how do I restart", top_k=3)

    assert len(search_bodies(requests)) == 2
    # p2 is second for one arm and first for the other, which beats p1 being
    # first for only one arm even though p1 scored higher in raw cosine terms.
    assert [context["document_id"] for context in contexts] == [
        "doc-2",
        "doc-1",
        "doc-3",
    ]
    assert contexts[0]["score"] == 0.90


def test_each_arm_is_asked_for_the_window_instead_of_top_k() -> None:
    requests: list[httpx.Request] = []
    retriever = build_retriever(
        requests,
        arms=[arm(name="minilm"), arm(name="openai", tag=0.9)],
        response_handler=two_arm_handler,
        arm_window=10,
    )

    contexts = retriever.retrieve("user-1", "how do I restart", top_k=1)

    assert [body["limit"] for body in search_bodies(requests)] == [10, 10]
    assert len(contexts) == 1


def test_asking_for_more_results_than_the_window_widens_the_search() -> None:
    requests: list[httpx.Request] = []
    retriever = build_retriever(
        requests,
        arms=[arm(name="minilm"), arm(name="openai", tag=0.9)],
        response_handler=two_arm_handler,
        arm_window=4,
    )

    retriever.retrieve("user-1", "how do I restart", top_k=12)

    assert [body["limit"] for body in search_bodies(requests)] == [12, 12]


WINDOW_RANKINGS: dict[str, list[tuple[str, str, float]]] = {
    "minilm": [
        ("m1", "doc-both-rank-1", 0.80),
        ("m2", "doc-m2", 0.75),
        ("m3", "doc-m3", 0.70),
        ("shared", "doc-agreed-on", 0.60),
    ],
    "openai": [
        ("o1", "doc-o1", 0.85),
        ("o2", "doc-o2", 0.78),
        ("o3", "doc-o3", 0.66),
        ("shared", "doc-agreed-on", 0.61),
    ],
}


def window_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/points/search"):
        body = json.loads(request.content)
        ranking = WINDOW_RANKINGS[body["vector"]["name"]]
        return httpx.Response(
            200,
            json={
                "result": [
                    point(point_id, document_id, index, score)
                    for index, (point_id, document_id, score) in enumerate(
                        ranking[: body["limit"]]
                    )
                ]
            },
        )
    if request.url.path.endswith("/points/scroll"):
        return httpx.Response(200, json={"result": {"points": []}})
    return httpx.Response(
        200,
        json={
            "result": {
                "config": {
                    "params": {
                        "vectors": {"minilm": {"size": 2}, "openai": {"size": 2}}
                    }
                }
            }
        },
    )


def two_window_arms() -> list[RetrievalArm]:
    return [arm(name="minilm"), arm(name="openai", tag=0.9)]


def test_a_shallow_window_hides_a_chunk_both_arms_agree_on() -> None:
    retriever = build_retriever(
        [],
        arms=two_window_arms(),
        response_handler=window_handler,
        arm_window=3,
    )

    contexts = retriever.retrieve("user-1", "how do I restart", top_k=3)

    # Each arm stops before the shared chunk, so the top 3 is decided by the
    # leaders of each arm alone.
    assert [context["document_id"] for context in contexts] == [
        "doc-both-rank-1",
        "doc-o1",
        "doc-m2",
    ]


def test_a_deeper_window_lets_agreement_outrank_a_single_arm_leader() -> None:
    retriever = build_retriever(
        [],
        arms=two_window_arms(),
        response_handler=window_handler,
        arm_window=4,
    )

    contexts = retriever.retrieve("user-1", "how do I restart", top_k=3)

    # Fourth for each arm is still second-best overall once both arms list it.
    assert contexts[0]["document_id"] == "doc-agreed-on"


def test_a_failing_arm_fails_the_query_rather_than_retrieving_one_way() -> None:
    requests: list[httpx.Request] = []

    def failing(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/scroll"):
            return httpx.Response(200, json={"result": {"points": []}})
        if request.url.path.endswith("/points/search"):
            body = json.loads(request.content)
            if isinstance(body["vector"], dict) and body["vector"]["name"] == "openai":
                raise httpx.ConnectError("embedding endpoint is down")
            return httpx.Response(
                200,
                json={"result": [point("p1", "doc-1", 0, 0.70)]},
            )
        return httpx.Response(
            200,
            json={
                "result": {
                    "config": {
                        "params": {"vectors": {"minilm": {"size": 2}, "openai": {"size": 2}}}
                    }
                }
            },
        )

    retriever = build_retriever(
        requests,
        arms=[arm(name="minilm"), arm(name="openai", tag=0.9)],
        response_handler=failing,
    )

    with pytest.raises(httpx.ConnectError):
        retriever.retrieve("user-1", "how do I restart")


def test_retriever_requires_an_arm() -> None:
    with pytest.raises(ValueError, match="at least one retrieval arm"):
        QdrantRetriever(
            qdrant_url="http://qdrant.local",
            collection_name=COLLECTION,
            arms=[],
        )


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
        arms=[arm()],
        client=httpx.Client(transport=httpx.MockTransport(mismatched)),
    )

    with pytest.raises(RuntimeError, match="stores 1024-dimension vectors"):
        retriever.retrieve("user-1", "how do I restart")


def test_retrieve_refuses_a_slot_the_collection_does_not_have() -> None:
    def single_slot(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/search"):
            raise AssertionError("search must not run against a mismatched collection")
        return httpx.Response(
            200,
            json={"result": {"config": {"params": {"vectors": {"size": 2}}}}},
        )

    retriever = QdrantRetriever(
        qdrant_url="http://qdrant.local",
        collection_name=COLLECTION,
        arms=[arm(name="minilm"), arm(name="openai")],
        client=httpx.Client(transport=httpx.MockTransport(single_slot)),
    )

    with pytest.raises(RuntimeError, match="has no vector slot"):
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
        arms=[arm(model_label="paraphrase-multilingual-MiniLM-L12-v2")],
        client=httpx.Client(transport=httpx.MockTransport(mismatched)),
    )

    with pytest.raises(RuntimeError, match="indexed with 'bge-m3'"):
        retriever.retrieve("user-1", "how do I restart")


def test_settings_with_a_second_provider_add_a_second_arm() -> None:
    settings = Settings(
        embedding_provider="deterministic",
        embedding_vector_name="minilm",
        embedding_dimensions=2,
        secondary_embedding_provider="deterministic",
        secondary_embedding_dimensions=2,
    )

    names = [retriever_arm.name for retriever_arm in retriever_from_settings(settings)._arms]

    assert names == ["minilm", "openai"]


def test_a_second_arm_needs_a_named_vector_slot() -> None:
    settings = Settings(
        embedding_provider="deterministic",
        secondary_embedding_provider="deterministic",
    )

    with pytest.raises(ValueError, match="EMBEDDING_VECTOR_NAME"):
        retriever_from_settings(settings)


def test_the_configured_window_reaches_the_retriever() -> None:
    settings = Settings(
        embedding_provider="deterministic",
        retrieval_arm_window=20,
    )

    assert retriever_from_settings(settings)._arm_window == 20
