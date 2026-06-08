from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import httpx
import app.main as main

from app.core.config import Settings
from app.documents.repository import InMemoryDocumentRepository
from app.main import app
from app.services.indexing_health import build_indexing_health
from app.services.qdrant_health import check_qdrant_health


client = TestClient(app)


def test_health_returns_api_status() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "contexta-api"}


def test_vector_health_returns_ok_status(monkeypatch) -> None:
    async def check_qdrant_health(qdrant_url: str) -> dict[str, str]:
        return {"status": "ok", "service": "qdrant"}

    monkeypatch.setattr(main, "check_qdrant_health", check_qdrant_health)

    response = client.get("/health/vector")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "qdrant"}


def test_vector_health_returns_unavailable_status(monkeypatch) -> None:
    async def check_qdrant_health(qdrant_url: str) -> dict[str, str]:
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
