"""Hardening from the black-box audit: no public route map, no public index anatomy.

Both of these were reachable without credentials, so the guard belongs on the server —
a UI decision never was one.
"""

import importlib

import pytest
from fastapi.testclient import TestClient

import app.main as main

from app.auth.dependencies import get_optional_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings
from app.main import app, doc_urls


ANONYMOUS = TestClient(app)


@pytest.mark.parametrize("environment", ["production", "Production", " production "])
def test_docs_are_disabled_in_production(environment: str) -> None:
    assert doc_urls(environment) == (None, None, None)


@pytest.mark.parametrize("environment", ["development", "test"])
def test_docs_stay_available_outside_production(environment: str) -> None:
    assert doc_urls(environment) == ("/docs", "/redoc", "/openapi.json")


def test_production_app_answers_404_on_every_docs_route(monkeypatch) -> None:
    """The rule above has to be the rule the running app actually uses."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv(
        "SUPABASE_JWKS_URL", "https://example.test/auth/v1/.well-known/jwks.json"
    )
    get_settings.cache_clear()
    importlib.reload(main)

    try:
        production_client = TestClient(main.app)

        for path in ("/docs", "/redoc", "/openapi.json"):
            assert production_client.get(path).status_code == 404, path
        # The API itself still answers; only the map is gone.
        assert production_client.get("/health").status_code == 200
    finally:
        monkeypatch.delenv("ENVIRONMENT", raising=False)
        monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
        get_settings.cache_clear()
        importlib.reload(main)


def _stub_qdrant(monkeypatch) -> None:
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
            "points_count": 309,
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
            qdrant_collection="contexta_chunks_v3",
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


def test_anonymous_vector_health_reports_liveness_only(monkeypatch) -> None:
    _stub_qdrant(monkeypatch)
    app.dependency_overrides.clear()

    body = ANONYMOUS.get("/health/vector").json()

    assert body == {"status": "ok", "service": "qdrant"}
    for leak in ("collection", "points_count", "vector_spaces"):
        assert leak not in body


def test_signed_in_vector_health_keeps_the_index_detail(monkeypatch) -> None:
    _stub_qdrant(monkeypatch)
    app.dependency_overrides[get_optional_user] = lambda: CurrentUser(
        id="health-test-user", email="health@test.com", role="authenticated"
    )

    try:
        body = ANONYMOUS.get("/health/vector").json()
    finally:
        app.dependency_overrides.clear()

    assert body["collection"] == "contexta_chunks_v3"
    assert [space["name"] for space in body["vector_spaces"]] == ["minilm", "openai"]


def test_a_bad_token_still_gets_the_anonymous_answer(monkeypatch) -> None:
    _stub_qdrant(monkeypatch)
    app.dependency_overrides.clear()

    response = ANONYMOUS.get("/health/vector", headers={"Authorization": "Bearer not-a-jwt"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "qdrant"}
