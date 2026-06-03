from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_returns_api_status() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "contexta-api"}


def test_vector_health_returns_qdrant_status() -> None:
    response = client.get("/health/vector")

    assert response.status_code in {200, 503}
    body = response.json()
    assert "status" in body
    assert body["service"] == "qdrant"
