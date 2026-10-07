from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Annotated, Literal

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import Field
from starlette.responses import JSONResponse

from .config import HEALTH_PATH, MCP_PATH, McpSettings
from .security import ApiKeyRequiredMiddleware
from .upstream import ContextaClient

# Mirrors app.documents.models.DocumentType in the API. Kept as a Literal so the tool
# schema carries an enum the model can choose from instead of a free-text string.
DocType = Literal[
    "unclassified", "sop", "policy", "contract", "report", "thesis", "reference", "other"
]

INSTRUCTIONS = (
    "Contexta exposes one person's private document workspace as raw retrieval. "
    "Start with contexta_list_documents to see what exists, then contexta_retrieve for "
    "targeted evidence. Answers are never generated here: every tool returns text you "
    "must cite yourself, using the document name, page_number and section_path each "
    "chunk carries. Calls are metered against the API key's quota."
)

RETRIEVE_DESCRIPTION = (
    "Search the workspace's indexed documents and return the most relevant raw chunks. "
    "Each hit has document_id, document_name, doc_type, chunk_index, page_number, "
    "section_path, text and a fusion score (higher is better, not a probability). "
    "Retrieval only -- nothing is summarised or generated. Returns nothing for a "
    "document_id outside this key's scope. Costs 1 request against the key's quota."
)

LIST_DOCUMENTS_DESCRIPTION = (
    "List every document this key can read: id, filename, file_type, status, doc_type, "
    "chunk_count and indexed_at. Only status 'ready' documents are searchable. Use the "
    "returned id for contexta_export_document."
)

EXPORT_DOCUMENT_DESCRIPTION = (
    "Return the full text of one document. format='md' gives markdown with its heading "
    "structure preserved; format='jsonl' gives one JSON object per chunk with section_path "
    "and page_number. Prefer contexta_retrieve for a specific question -- this returns "
    "the whole document and costs 1 request against the key's quota."
)


def _authorization(ctx: Context) -> str:
    """The caller's key, verbatim, for the API to judge.

    `ctx.headers` is client input, so it is never treated as an identity here -- it is
    only forwarded, and the API's metering RPC decides who it belongs to.
    """
    authorization = (ctx.headers or {}).get("authorization")
    if not authorization:
        raise ToolError(
            "Missing API key. Add 'Authorization: Bearer ctx_live_...' to this MCP "
            "server's headers in your client config."
        )
    return authorization


def build_server(client: ContextaClient) -> MCPServer:
    @asynccontextmanager
    async def lifespan(server: MCPServer):
        try:
            yield {}
        finally:
            await client.aclose()

    server = MCPServer(
        name="contexta",
        version="0.1.0",
        instructions=INSTRUCTIONS,
        lifespan=lifespan,
    )

    @server.tool(name="contexta_retrieve", description=RETRIEVE_DESCRIPTION)
    async def contexta_retrieve(
        # Same bounds as the API's RetrieveRequest, declared here so an out-of-range
        # argument is a schema error rather than a metered round trip that fails.
        query: Annotated[str, Field(min_length=1, max_length=500)],
        ctx: Context,
        top_k: Annotated[int, Field(ge=1, le=20)] = 5,
        document_ids: Annotated[list[str] | None, Field(max_length=50)] = None,
        doc_types: list[DocType] | None = None,
    ) -> str:
        return await client.retrieve(
            _authorization(ctx),
            query,
            top_k=top_k,
            document_ids=document_ids,
            doc_types=doc_types,
        )

    @server.tool(name="contexta_list_documents", description=LIST_DOCUMENTS_DESCRIPTION)
    async def contexta_list_documents(ctx: Context) -> str:
        return await client.list_documents(_authorization(ctx))

    @server.tool(name="contexta_export_document", description=EXPORT_DOCUMENT_DESCRIPTION)
    async def contexta_export_document(
        ctx: Context,
        document_id: str,
        document_format: Literal["md", "jsonl"] = "md",
    ) -> str:
        return await client.export_document(
            _authorization(ctx), document_id, document_format
        )

    @server.custom_route(HEALTH_PATH, methods=["GET"])
    async def health(request) -> JSONResponse:
        return JSONResponse({"status": "ok", "service": "contexta-mcp"})

    return server


def build_app(settings: McpSettings):
    """Streamable HTTP app, mounted at /mcp, guarded by a bearer-token check.

    `json_response=True` because Caddy's `encode gzip` holds back flushed
    `text/event-stream` frames: an SSE session through this proxy looks like a hung
    client with no error anywhere. DNS rebinding protection is only meaningful with an
    explicit allowlist -- the SDK enables it automatically for localhost binds, and this
    binds 0.0.0.0 behind a proxy.
    """
    server = build_server(ContextaClient(settings.api_url))

    transport_security = (
        TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=list(settings.allowed_hosts),
            allowed_origins=[],
        )
        if settings.allowed_hosts
        else None
    )

    app = server.streamable_http_app(
        streamable_http_path=MCP_PATH,
        json_response=True,
        transport_security=transport_security,
        host="0.0.0.0",
    )
    return ApiKeyRequiredMiddleware(app)
