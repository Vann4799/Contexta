from __future__ import annotations

from typing import Any

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from contexta_mcp.server import _authorization, build_server
from contexta_mcp.upstream import ContextaClient

KEY = "Bearer ctx_live_AAAAAAAAAAAAAAAAAAAAAAAAAA"


class FakeContext:
    """The only part of the real Context these tools use is `headers`."""

    def __init__(self, headers: dict[str, Any] | None = None) -> None:
        self.headers = headers


@pytest.fixture
def server() -> Any:
    return build_server(ContextaClient("http://api:8001"))


def test_a_caller_without_a_key_is_told_where_to_get_one() -> None:
    with pytest.raises(ToolError) as excinfo:
        _authorization(FakeContext({}))

    assert "ctx_live_" in str(excinfo.value)


def test_a_caller_with_a_key_is_forwarded_without_inspection() -> None:
    assert _authorization(FakeContext({"authorization": KEY})) == KEY


@pytest.mark.asyncio
async def test_three_tools_are_registered_and_the_context_stays_invisible(server) -> None:
    tools = {tool.name: tool for tool in await server.list_tools()}

    assert set(tools) == {
        "contexta_retrieve",
        "contexta_list_documents",
        "contexta_export_document",
    }
    for tool in tools.values():
        assert "ctx" not in tool.input_schema["properties"]
        assert len(tool.description) > 80


@pytest.mark.asyncio
async def test_retrieve_schema_carries_the_api_bounds(server) -> None:
    properties = (await server.list_tools())[0]
    assert properties.name == "contexta_retrieve"

    schema = properties.input_schema
    assert schema["required"] == ["query"]
    assert schema["properties"]["query"]["maxLength"] == 500
    assert schema["properties"]["top_k"]["minimum"] == 1
    assert schema["properties"]["top_k"]["maximum"] == 20
    assert len(schema["properties"]["doc_types"]["anyOf"][0]["items"]["enum"]) == 8


@pytest.mark.asyncio
async def test_export_schema_offers_only_the_formats_the_api_serves(server) -> None:
    tools = {tool.name: tool for tool in await server.list_tools()}
    schema = tools["contexta_export_document"].input_schema

    assert schema["required"] == ["document_id"]
    assert schema["properties"]["document_format"]["enum"] == ["md", "jsonl"]


@pytest.mark.asyncio
async def test_the_server_tells_an_agent_to_cite_rather_than_paraphrase(server) -> None:
    instructions = server.instructions.lower()

    assert "cite" in instructions
    assert "raw" in instructions
    assert "generat" in instructions
