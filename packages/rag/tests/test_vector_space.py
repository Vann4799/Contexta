from __future__ import annotations

import json

import httpx
import pytest

from contexta_rag.embeddings import embedding_model_label
from contexta_rag.vector_space import (
    VectorSpace,
    assert_vector_spaces_match,
    reset_vector_space_cache,
)


def check_one_space(
    client: httpx.Client,
    collection_name: str = "contexta_chunks",
    dimensions: int = 384,
    model_label: str = "",
    qdrant_url: str = "http://qdrant.local",
) -> bool:
    """Run the guard the way a single-vector deployment would."""
    return assert_vector_spaces_match(
        client=client,
        qdrant_url=qdrant_url,
        collection_name=collection_name,
        spaces=[VectorSpace(name="", dimensions=dimensions, model_label=model_label)],
    )


def build_client(
    handler,
    requests: list[httpx.Request],
) -> httpx.Client:
    def transport_handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return handler(request)

    return httpx.Client(transport=httpx.MockTransport(transport_handler))


def collection_info(dimensions: int) -> httpx.Response:
    return httpx.Response(
        200,
        json={"result": {"config": {"params": {"vectors": {"size": dimensions}}}}},
    )


def scroll_with_payload(payload: dict[str, object]) -> httpx.Response:
    return httpx.Response(200, json={"result": {"points": [{"payload": payload}]}})


NO_SCROLL = httpx.Response(200, json={"result": {"points": []}})


@pytest.fixture(autouse=True)
def clear_vector_space_cache() -> None:
    reset_vector_space_cache()


def test_missing_collection_reports_false_without_scoring_anything() -> None:
    requests: list[httpx.Request] = []
    client = build_client(lambda _request: httpx.Response(404), requests)

    exists = check_one_space(
        client,
        collection_name="contexta_chunks_v2",
        model_label="deterministic-hash",
    )

    assert exists is False
    assert [request.method for request in requests] == ["GET"]


def test_matching_vector_space_passes() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/scroll"):
            return scroll_with_payload({"embedding_model": "miniLM-multilingual"})
        return collection_info(384)

    client = build_client(handler, [])

    assert (
        check_one_space(
            client,
            collection_name="contexta_chunks_v2",
            model_label="miniLM-multilingual",
        )
        is True
    )


def test_dimension_mismatch_raises_before_any_query_is_trusted() -> None:
    requests: list[httpx.Request] = []
    client = build_client(lambda _request: collection_info(1024), requests)

    with pytest.raises(RuntimeError, match="stores 1024-dimension vectors"):
        check_one_space(client)

    assert [request.method for request in requests] == ["GET"]


def test_same_dimension_provider_swap_is_caught_from_the_payload_label() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/scroll"):
            return scroll_with_payload({"embedding_model": "deterministic-hash"})
        return collection_info(384)

    with pytest.raises(RuntimeError, match="indexed with 'deterministic-hash'"):
        check_one_space(
            build_client(handler, []),
            model_label="miniLM-multilingual",
        )


def test_collection_without_recorded_model_label_is_not_blocked() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/points/scroll"):
            return scroll_with_payload({"chunk_index": 0})
        return collection_info(384)

    assert (
        check_one_space(
            build_client(handler, []),
            model_label="miniLM-multilingual",
        )
        is True
    )


def test_without_a_model_label_the_payload_is_not_scrolled() -> None:
    requests: list[httpx.Request] = []
    client = build_client(lambda _request: collection_info(384), requests)

    check_one_space(client)

    assert [request.url.path for request in requests] == ["/collections/contexta_chunks"]


def test_verified_collection_is_only_checked_once_per_process() -> None:
    requests: list[httpx.Request] = []
    client = build_client(
        lambda request: NO_SCROLL
        if request.url.path.endswith("/points/scroll")
        else collection_info(384),
        requests,
    )
    check_one_space(
        client,
        collection_name="contexta_chunks_v2",
        model_label="miniLM-multilingual",
    )
    check_one_space(
        client,
        collection_name="contexta_chunks_v2",
        model_label="miniLM-multilingual",
    )

    assert len(requests) == 2


def test_embedding_model_label_names_the_fallback_provider() -> None:
    assert embedding_model_label("deterministic", "unused") == "deterministic-hash"
    assert embedding_model_label("HASH", "unused") == "deterministic-hash"
    assert embedding_model_label("remote", "miniLM") == "miniLM"
    assert embedding_model_label("sentence-transformers", "BAAI/bge-m3") == "BAAI/bge-m3"


def test_scroll_body_asks_for_only_the_label_fields() -> None:
    requests: list[httpx.Request] = []
    client = build_client(
        lambda request: NO_SCROLL
        if request.url.path.endswith("/points/scroll")
        else collection_info(384),
        requests,
    )

    check_one_space(client, model_label="miniLM-multilingual")

    scroll = requests[1]
    assert scroll.method == "POST"
    assert json.loads(scroll.content) == {
        "limit": 1,
        "with_payload": ["embedding_model", "embedding_models"],
    }


def named_collection_info(spaces: dict[str, int]) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "result": {
                "config": {
                    "params": {
                        "vectors": {
                            name: {"size": size, "distance": "Cosine"}
                            for name, size in spaces.items()
                        }
                    }
                }
            }
        },
    )


def test_two_named_slots_of_one_collection_are_verified_in_a_single_round_trip() -> None:
    requests: list[httpx.Request] = []
    client = build_client(
        lambda request: NO_SCROLL
        if request.url.path.endswith("/points/scroll")
        else named_collection_info({"minilm": 384, "openai": 1536}),
        requests,
    )

    exists = assert_vector_spaces_match(
        client=client,
        qdrant_url="http://qdrant.local",
        collection_name="contexta_chunks_v3",
        spaces=[
            VectorSpace(name="minilm", dimensions=384, model_label="minilm"),
            VectorSpace(name="openai", dimensions=1536, model_label="text-embedding-3-small"),
        ],
    )

    assert exists is True
    assert [json.loads(r.content) for r in requests if r.method == "POST"] == [
        {"limit": 1, "with_payload": ["embedding_model", "embedding_models"]}
    ]


def test_a_missing_named_slot_is_rejected_rather_than_created_quietly() -> None:
    client = build_client(
        lambda request: NO_SCROLL
        if request.url.path.endswith("/points/scroll")
        else named_collection_info({"minilm": 384}),
        [],
    )

    with pytest.raises(RuntimeError, match="no vector slot 'openai'"):
        assert_vector_spaces_match(
            client=client,
            qdrant_url="http://qdrant.local",
            collection_name="contexta_chunks_v3",
            spaces=[
                VectorSpace(name="minilm", dimensions=384, model_label="minilm"),
                VectorSpace(name="openai", dimensions=1536, model_label="openai-small"),
            ],
        )


def test_a_named_slot_with_the_wrong_size_is_rejected() -> None:
    client = build_client(
        lambda request: NO_SCROLL
        if request.url.path.endswith("/points/scroll")
        else named_collection_info({"minilm": 384, "openai": 1024}),
        [],
    )

    with pytest.raises(RuntimeError, match="stores 1024-dimension vectors in slot 'openai'"):
        assert_vector_spaces_match(
            client=client,
            qdrant_url="http://qdrant.local",
            collection_name="contexta_chunks_v3",
            spaces=[
                VectorSpace(name="minilm", dimensions=384, model_label="minilm"),
                VectorSpace(name="openai", dimensions=1536, model_label="openai-small"),
            ],
        )


def test_per_slot_model_labels_are_read_from_the_embedding_models_payload() -> None:
    client = build_client(
        lambda request: scroll_with_payload(
            {"embedding_models": {"minilm": "minilm", "openai": "some-older-model"}}
        )
        if request.url.path.endswith("/points/scroll")
        else named_collection_info({"minilm": 384, "openai": 1536}),
        [],
    )

    with pytest.raises(RuntimeError, match="indexed in slot 'openai' with 'some-older-model'"):
        assert_vector_spaces_match(
            client=client,
            qdrant_url="http://qdrant.local",
            collection_name="contexta_chunks_v3",
            spaces=[
                VectorSpace(name="minilm", dimensions=384, model_label="minilm"),
                VectorSpace(name="openai", dimensions=1536, model_label="openai-small"),
            ],
        )
