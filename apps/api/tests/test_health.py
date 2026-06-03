from fastapi.testclient import TestClient
import httpx
import app.main as main

from app.main import app
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


async def test_qdrant_health_non_2xx_returns_unavailable(monkeypatch) -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(500))
    async_client_class = httpx.AsyncClient

    def async_client(*args, **kwargs) -> httpx.AsyncClient:
        return async_client_class(transport=transport, *args, **kwargs)

    monkeypatch.setattr("app.services.qdrant_health.httpx.AsyncClient", async_client)

    response = await check_qdrant_health("http://qdrant.example")

    assert response == {"status": "unavailable", "service": "qdrant"}
