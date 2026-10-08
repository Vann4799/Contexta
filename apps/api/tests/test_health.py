import threading
import time
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import httpx
import app.main as main

from app.core.config import Settings
from app.documents.repository import InMemoryDocumentRepository
from app.main import app
from app.services.indexing_health import IndexingHealthResponse, build_indexing_health
from app.services.qdrant_health import check_qdrant_health
from contexta_rag.vector_space import VectorSpace


client = TestClient(app)


def test_health_returns_api_status() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "contexta-api"}


def test_vector_health_returns_ok_status(monkeypatch) -> None:
    async def check_qdrant_health(
        qdrant_url: str,
        api_key: str = "",
        collection: str = "",
        spaces: tuple = (),
    ) -> dict[str, object]:
        return {
            "status": "ok",
            "service": "qdrant",
            "collection": collection,
            "vector_spaces": [
                {"name": space.name, "dimensions": space.dimensions, "model": space.model_label}
                for space in spaces
            ],
        }

    monkeypatch.setattr(main, "check_qdrant_health", check_qdrant_health)
    monkeypatch.setattr(
        main,
        "get_settings",
        lambda: Settings(
            qdrant_collection="contexta_chunks_v9",
            embedding_provider="remote",
            embedding_model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            embedding_dimensions=384,
            embedding_vector_name="minilm",
            secondary_embedding_provider="openrouter",
            secondary_embedding_model_name="openai/text-embedding-3-small",
            secondary_embedding_dimensions=1536,
            secondary_embedding_vector_name="openai",
        ),
    )

    response = client.get("/health/vector")
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "ok"
    assert body["service"] == "qdrant"
    assert body["collection"] == "contexta_chunks_v9"
    assert body["vector_spaces"] == [
        {"name": "minilm", "dimensions": 384, "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"},
        {"name": "openai", "dimensions": 1536, "model": "openai/text-embedding-3-small"},
    ]


def test_vector_health_returns_unavailable_status(monkeypatch) -> None:
    async def check_qdrant_health(
        qdrant_url: str,
        api_key: str = "",
        collection: str = "",
        spaces: tuple = (),
    ) -> dict[str, object]:
        return {"status": "unavailable", "service": "qdrant"}

    monkeypatch.setattr(main, "check_qdrant_health", check_qdrant_health)

    response = client.get("/health/vector")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "service": "qdrant"}


def test_indexing_health_returns_unknown_ok_without_repository_data(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "get_settings",
        lambda: Settings(supabase_url="", supabase_service_role_key=""),
    )
    monkeypatch.setattr(
        "app.services.indexing_health.document_repository",
        InMemoryDocumentRepository(),
    )

    response = client.get("/health/indexing")
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "ok"
    assert body["service"] == "indexing"
    assert body["source"] == "unknown"
    assert body["processing_documents"] == 0
    assert body["queued_documents"] == 0
    assert body["stale_processing_documents"] == 0


def test_indexing_health_reports_attention_for_stale_processing_documents(monkeypatch) -> None:
    now = datetime.now(timezone.utc)
    stale_started_at = (now - timedelta(minutes=20)).isoformat()
    fresh_updated_at = (now - timedelta(minutes=2)).isoformat()

    monkeypatch.setattr(
        main,
        "get_settings",
        lambda: Settings(
            supabase_url="https://supabase.example",
            supabase_service_role_key="service-role-key",
        ),
    )

    def get_documents(*args, **kwargs) -> httpx.Response:
        return httpx.Response(
            200,
            request=httpx.Request("GET", "https://supabase.example/rest/v1/documents"),
            json=[
                {
                    "status": "processing",
                    "updated_at": stale_started_at,
                    "processing_started_at": stale_started_at,
                },
                {
                    "status": "processing",
                    "updated_at": fresh_updated_at,
                    "processing_started_at": fresh_updated_at,
                },
                {
                    "status": "uploaded",
                    "updated_at": fresh_updated_at,
                    "processing_started_at": None,
                },
            ],
        )

    monkeypatch.setattr("app.services.indexing_health.httpx.get", get_documents)

    response = client.get("/health/indexing")
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "attention"
    assert body["source"] == "supabase"
    assert body["processing_documents"] == 2
    assert body["queued_documents"] == 1
    assert body["stale_processing_documents"] == 1
    assert body["stale_after_minutes"] == 10


def test_a_slow_indexing_health_check_leaves_the_event_loop_free(monkeypatch) -> None:
    """The health check blocks on httpx. A sync def route runs it in the threadpool;
    declared async def it would run on the event loop, and one slow Supabase answer
    would stall every concurrent request with it."""

    entered = threading.Event()
    release = threading.Event()

    def slow_check(settings: Settings) -> IndexingHealthResponse:
        entered.set()
        release.wait(timeout=5)
        return build_indexing_health([], source="unknown")

    monkeypatch.setattr(main, "check_indexing_health", slow_check)

    with TestClient(app) as scoped:
        slow_result: list[httpx.Response] = []

        def slow_request() -> None:
            slow_result.append(scoped.get("/health/indexing"))

        thread = threading.Thread(target=slow_request)
        thread.start()
        assert entered.wait(timeout=5)

        fast_started = time.perf_counter()
        fast = scoped.get("/health")
        fast_elapsed = time.perf_counter() - fast_started

        release.set()
        thread.join(timeout=5)

    assert fast.status_code == 200
    assert slow_result[0].status_code == 200
    assert fast_elapsed < 0.5


def test_build_indexing_health_uses_updated_at_when_processing_started_at_is_unknown() -> None:
    now = datetime(2026, 6, 8, 10, 0, tzinfo=timezone.utc)

    health_status = build_indexing_health(
        [
            {
                "status": "processing",
                "updated_at": "2026-06-08T09:45:00+00:00",
                "processing_started_at": None,
            }
        ],
        source="supabase",
        now=now,
    )

    assert health_status.status == "attention"
    assert health_status.processing_documents == 1
    assert health_status.stale_processing_documents == 1


async def test_qdrant_health_non_2xx_returns_unavailable(monkeypatch) -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(500))
    async_client_class = httpx.AsyncClient

    def async_client(*args, **kwargs) -> httpx.AsyncClient:
        return async_client_class(transport=transport, *args, **kwargs)

    monkeypatch.setattr("app.services.qdrant_health.httpx.AsyncClient", async_client)

    response = await check_qdrant_health("http://qdrant.example")

    assert response == {"status": "unavailable", "service": "qdrant"}


async def test_qdrant_health_sends_api_key_header(monkeypatch) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"status": "ok"})

    async_client_class = httpx.AsyncClient

    def async_client(*args, **kwargs) -> httpx.AsyncClient:
        return async_client_class(transport=httpx.MockTransport(handler), *args, **kwargs)

    monkeypatch.setattr("app.services.qdrant_health.httpx.AsyncClient", async_client)

    response = await check_qdrant_health("http://qdrant.example", "qdrant-key")

    assert response["status"] == "ok"
    assert response["service"] == "qdrant"
    assert requests[0].headers["api-key"] == "qdrant-key"


async def test_qdrant_health_reports_the_active_collection_as_qdrant_sees_it(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/healthz":
            return httpx.Response(200, json={"status": "ok"})
        return httpx.Response(
            200,
            json={
                "result": {
                    "points_count": 198,
                    "config": {"params": {"vectors": {"minilm": {"size": 384}, "openai": {"size": 1536}}}},
                }
            },
        )

    async_client_class = httpx.AsyncClient
    monkeypatch.setattr(
        "app.services.qdrant_health.httpx.AsyncClient",
        lambda *args, **kwargs: async_client_class(transport=httpx.MockTransport(handler), *args, **kwargs),
    )

    response = await check_qdrant_health(
        "http://qdrant.example",
        "qdrant-key",
        collection="contexta_chunks_v3",
        spaces=(VectorSpace(name="minilm", dimensions=384, model_label="a"),),
    )

    assert response["collection"] == "contexta_chunks_v3"
    assert response["points_count"] == 198
    assert [slot["dimensions"] for slot in response["vector_spaces"]] == [384]


async def test_qdrant_health_reports_dimensions_stored_by_another_slot(monkeypatch) -> None:
    """A drifted QDRANT_COLLECTION must show up here, not only as a query failure."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/healthz":
            return httpx.Response(200, json={"status": "ok"})
        return httpx.Response(
            200,
            json={"result": {"points_count": 12, "config": {"params": {"vectors": {"minilm": {"size": 1024}}}}}},
        )

    async_client_class = httpx.AsyncClient
    monkeypatch.setattr(
        "app.services.qdrant_health.httpx.AsyncClient",
        lambda *args, **kwargs: async_client_class(transport=httpx.MockTransport(handler), *args, **kwargs),
    )

    response = await check_qdrant_health(
        "http://qdrant.example",
        collection="contexta_chunks_old",
        spaces=(VectorSpace(name="minilm", dimensions=384, model_label="a"),),
    )

    assert response["vector_spaces"] == [{"name": "minilm", "dimensions": 1024, "model": "a"}]


async def test_qdrant_health_keeps_reporting_a_missing_collection(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/healthz":
            return httpx.Response(200, json={"status": "ok"})
        return httpx.Response(404, json={"status": "not_found"})

    async_client_class = httpx.AsyncClient
    monkeypatch.setattr(
        "app.services.qdrant_health.httpx.AsyncClient",
        lambda *args, **kwargs: async_client_class(transport=httpx.MockTransport(handler), *args, **kwargs),
    )

    response = await check_qdrant_health(
        "http://qdrant.example",
        collection="contexta_chunks_v3",
        spaces=(VectorSpace(name="", dimensions=384, model_label="a"),),
    )

    assert response["status"] == "ok"
    assert response["collection"] == "contexta_chunks_v3"
    assert response["points_count"] is None
    assert response["vector_spaces"] == [{"name": "", "dimensions": 384, "model": "a"}]
