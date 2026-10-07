from __future__ import annotations

import re
from typing import Any, Literal

import httpx2 as httpx
from mcp.server.mcpserver.exceptions import ToolError

REQUEST_TIMEOUT_SECONDS = 60.0
MAX_ERROR_MESSAGE_CHARS = 300
# Every /v1 path segment that comes back from the model is interpolated into a URL, and
# httpx normalises `..` the way RFC 3986 says to. Without this check a document_id of
# "../../api-keys" would leave /v1/documents/ and hit a different endpoint as this key.
DOCUMENT_ID_PATTERN = re.compile(r"^[0-9a-fA-F]{8}(?:-?[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$")

ExportFormat = Literal["md", "jsonl"]


class ContextaClient:
    """Thin /v1 caller.

    It raises `ToolError` rather than its own exception type on purpose: the MCP layer
    only forwards a tool's own words to the model when the failure is a `ToolError`, so
    anything else would reach the caller as "Error executing tool" with no cause.
    """

    def __init__(
        self,
        base_url: str,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: float = REQUEST_TIMEOUT_SECONDS,
    ) -> None:
        self._http = httpx.AsyncClient(base_url=base_url, timeout=timeout, transport=transport)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def retrieve(
        self,
        authorization: str,
        query: str,
        *,
        top_k: int = 5,
        document_ids: list[str] | None = None,
        doc_types: list[str] | None = None,
    ) -> str:
        payload: dict[str, Any] = {"query": query, "top_k": top_k}
        if document_ids:
            payload["document_ids"] = document_ids
        if doc_types:
            payload["doc_types"] = doc_types
        response = await self._request("POST", "/v1/retrieve", authorization, json=payload)
        return response.text

    async def list_documents(self, authorization: str) -> str:
        response = await self._request("GET", "/v1/documents", authorization)
        return response.text

    async def export_document(
        self, authorization: str, document_id: str, document_format: ExportFormat = "md"
    ) -> str:
        if not DOCUMENT_ID_PATTERN.match(document_id):
            raise ToolError(
                "document_id must be a UUID exactly as returned by contexta_list_documents."
            )
        response = await self._request(
            "GET",
            f"/v1/documents/{document_id}/export",
            authorization,
            params={"format": document_format},
        )
        return response.text

    async def _request(
        self,
        method: str,
        path: str,
        authorization: str,
        **kwargs: Any,
    ) -> httpx.Response:
        try:
            response = await self._http.request(
                method, path, headers={"authorization": authorization}, **kwargs
            )
        except httpx.TimeoutException as exc:
            raise ToolError(
                f"contexta did not answer within {REQUEST_TIMEOUT_SECONDS:.0f}s. "
                "Retrieval on a large workspace is slow; retry once before giving up."
            ) from exc
        except httpx.RequestError as exc:
            raise ToolError(
                "contexta API is unreachable from the MCP server. Try again shortly."
            ) from exc

        if response.status_code >= 400:
            raise ToolError(_describe(response))
        return response


def _describe(response: httpx.Response) -> str:
    """Turn a /v1 error into one line a model can act on.

    The API's `detail` is already `{code, message}` and carries no internals, so the code
    is worth keeping verbatim: it is the difference between "fix your query" and "the key
    ran out".
    """
    code = ""
    message = ""
    try:
        detail = response.json().get("detail")
    except Exception:  # noqa: BLE001 - a proxy or crash can answer in HTML
        detail = None
    if isinstance(detail, dict):
        code = str(detail.get("code") or "")
        message = str(detail.get("message") or "")
    elif isinstance(detail, str):
        message = detail

    if not message:
        message = f"contexta returned HTTP {response.status_code}."
    message = message[:MAX_ERROR_MESSAGE_CHARS]
    if code:
        message = f"{message} (code={code})"

    retry_after = response.headers.get("retry-after")
    if retry_after:
        message = f"{message} Retry in {retry_after}s."
    return message
