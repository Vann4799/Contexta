from __future__ import annotations

import json
from typing import Any

import httpx2 as httpx
import pytest
from mcp.server.mcpserver.exceptions import ToolError

from contexta_mcp.upstream import ContextaClient

AUTH_HEADER = "Bearer ctx_live_AAAAAAAAAAAAAAAAAAAAAAAAAA"


class Recorder:
    """A fake /v1 that records what the MCP server actually put on the wire."""

    def __init__(self, response: httpx.Response) -> None:
        self.response = response
        self.requests: list[httpx.Request] = []

    @property
    def client(self) -> ContextaClient:
        def handler(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            return self.response

        return ContextaClient("http://api:8001", transport=httpx.MockTransport(handler))

    @property
    def last(self) -> httpx.Request:
        assert self.requests, "no request reached the API"
        return self.requests[-1]


def ok(payload: Any = None, *, headers: dict[str, str] | None = None) -> httpx.Response:
    return httpx.Response(200, json=payload if payload is not None else {"data": []}, headers=headers)


@pytest.mark.asyncio
async def test_retrieve_forwards_the_callers_key_verbatim() -> None:
    store = Recorder(ok({"data": [{"text": "chunk"}]}))
    body = await store.client.retrieve(AUTH_HEADER, "apa itu bab 5", top_k=3)

    request = store.last
    assert request.method == "POST"
    assert request.url.path == "/v1/retrieve"
    assert request.headers["authorization"] == AUTH_HEADER
    assert json.loads(request.content) == {"query": "apa itu bab 5", "top_k": 3}
    assert json.loads(body)["data"][0]["text"] == "chunk"


@pytest.mark.asyncio
async def test_empty_filters_are_left_out_of_the_payload() -> None:
    """An explicit empty `document_ids` would be a different question than omitting it."""
    store = Recorder(ok())
    await store.client.retrieve(
        AUTH_HEADER, "q", document_ids=[], doc_types=None
    )

    assert json.loads(store.last.content) == {"query": "q", "top_k": 5}


@pytest.mark.asyncio
async def test_scoped_arguments_reach_the_api() -> None:
    store = Recorder(ok())
    await store.client.retrieve(
        AUTH_HEADER, "q", document_ids=["11111111-1111-1111-1111-111111111111"], doc_types=["thesis"]
    )

    payload = json.loads(store.last.content)
    assert payload["doc_types"] == ["thesis"]
    assert payload["document_ids"] == ["11111111-1111-1111-1111-111111111111"]


@pytest.mark.asyncio
async def test_list_documents_is_a_get_with_the_key() -> None:
    store = Recorder(ok({"data": [{"id": "x"}]}))
    body = await store.client.list_documents(AUTH_HEADER)

    assert store.last.method == "GET"
    assert store.last.url.path == "/v1/documents"
    assert store.last.headers["authorization"] == AUTH_HEADER
    assert json.loads(body)["data"][0]["id"] == "x"


@pytest.mark.asyncio
async def test_export_returns_the_document_text_not_json_envelope() -> None:
    store = Recorder(httpx.Response(200, text="# Judul\nisi", headers={"content-type": "text/markdown"}))
    body = await store.client.export_document(
        AUTH_HEADER, "11111111-1111-1111-1111-111111111111", "md"
    )

    assert body == "# Judul\nisi"
    assert store.last.url.path == "/v1/documents/11111111-1111-1111-1111-111111111111/export"
    assert store.last.url.params["format"] == "md"


@pytest.mark.asyncio
async def test_a_traversal_shaped_document_id_never_reaches_the_api() -> None:
    """httpx resolves `..` in the path, so an unvalidated id leaves /v1/documents/."""
    store = Recorder(ok())
    with pytest.raises(ToolError):
        await store.client.export_document(AUTH_HEADER, "../../api-keys", "md")

    assert store.requests == []


@pytest.mark.asyncio
async def test_quota_error_keeps_the_code_and_the_wait_the_model_needs() -> None:
    store = Recorder(
        httpx.Response(
            429,
            json={"detail": {"code": "quota_minute_exceeded", "message": "Too many requests."}},
            headers={"retry-after": "51"},
        )
    )
    with pytest.raises(ToolError) as excinfo:
        await store.client.retrieve(AUTH_HEADER, "q")

    message = str(excinfo.value)
    assert "quota_minute_exceeded" in message
    assert "Retry in 51s." in message


@pytest.mark.asyncio
async def test_revoked_key_error_is_passed_through_as_the_api_wrote_it() -> None:
    store = Recorder(
        httpx.Response(
            403,
            json={"detail": {"code": "api_key_revoked", "message": "This key has been revoked."}},
        )
    )
    with pytest.raises(ToolError) as excinfo:
        await store.client.list_documents(AUTH_HEADER)

    assert "api_key_revoked" in str(excinfo.value)


@pytest.mark.asyncio
async def test_a_non_json_error_body_does_not_reach_the_caller() -> None:
    """A proxy page or a crash trace must not become something a model repeats."""
    store = Recorder(httpx.Response(502, text="<html>upstream traceback at /app/secrets.py</html>"))
    with pytest.raises(ToolError) as excinfo:
        await store.client.list_documents(AUTH_HEADER)

    message = str(excinfo.value)
    assert "502" in message
    assert "traceback" not in message
    assert "secrets" not in message


@pytest.mark.asyncio
async def test_timeout_becomes_a_readable_retry_hint() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    client = ContextaClient("http://api:8001", transport=httpx.MockTransport(handler))
    with pytest.raises(ToolError) as excinfo:
        await client.retrieve(AUTH_HEADER, "q")

    assert "retry" in str(excinfo.value).lower()
