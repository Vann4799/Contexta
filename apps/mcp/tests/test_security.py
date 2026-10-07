from __future__ import annotations

import httpx2 as httpx
import pytest

from contexta_mcp.config import McpSettings
from contexta_mcp.security import ApiKeyRequiredMiddleware
from contexta_mcp.server import build_app

PASSTHROUGH_BODY = b"reached the MCP handler"


async def inner_app(scope, receive, send) -> None:
    await send(
        {
            "type": "http.response.start",
            "status": 200,
            "headers": [(b"content-type", b"text/plain")],
        }
    )
    await send({"type": "http.response.body", "body": PASSTHROUGH_BODY})


async def call(app, method: str, path: str, **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://mcp") as client:
        return await client.request(method, path, **kwargs)


@pytest.mark.asyncio
async def test_a_request_without_any_authorization_is_refused_before_the_handshake() -> None:
    response = await call(ApiKeyRequiredMiddleware(inner_app), "POST", "/mcp", json={"x": 1})

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "missing_api_key"
    assert "ctx_live_" in response.json()["detail"]["message"]
    assert response.headers["www-authenticate"].startswith("Bearer")


@pytest.mark.asyncio
async def test_an_empty_bearer_is_refused() -> None:
    app = ApiKeyRequiredMiddleware(inner_app)

    for value in ("Bearer ", "Bearer   ", "Token ctx_live_x"):
        response = await call(app, "POST", "/mcp", headers={"authorization": value}, json={})
        assert response.status_code == 401, value


@pytest.mark.asyncio
async def test_a_bearer_token_reaches_the_mcp_handler_untouched() -> None:
    """Validity is the API's decision; this layer must not interpret the secret."""
    response = await call(
        ApiKeyRequiredMiddleware(inner_app),
        "POST",
        "/mcp",
        headers={"authorization": "Bearer ctx_live_notverifiedhere"},
        json={},
    )

    assert response.status_code == 200
    assert response.text == "reached the MCP handler"


@pytest.mark.asyncio
async def test_health_stays_open_for_the_container_healthcheck() -> None:
    app = build_app(McpSettings(api_url="http://api:8001"))
    response = await call(app, "GET", "/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "contexta-mcp"}


@pytest.mark.asyncio
async def test_the_mcp_route_exists_on_the_real_app_at_the_configured_path() -> None:
    app = build_app(McpSettings(api_url="http://api:8001", allowed_hosts=("api.example.com",)))
    response = await call(app, "POST", "/mcp", json={})

    assert response.status_code == 401
