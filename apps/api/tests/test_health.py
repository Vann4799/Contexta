from fastapi.testclient import TestClient
import app.main as main

from app.main import app


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
