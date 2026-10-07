from __future__ import annotations

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from .config import MCP_PATH

_CHALLENGE = "Bearer realm=\"contexta\", error=\"invalid_request\""


class ApiKeyRequiredMiddleware:
    """Refuses a request that carries no bearer token, before the MCP handshake runs.

    Presence only, never validity: deciding whether a key is real, revoked, expired or
    out of quota is the API's job, and it does that once per call with its metering RPC.
    Checking the shape or the hash here would be a second implementation of that decision
    -- the exact mistake T7 made.
    """

    def __init__(self, app: ASGIApp, protected_path: str = MCP_PATH) -> None:
        self.app = app
        self.protected_path = protected_path

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith(self.protected_path):
            await self.app(scope, receive, send)
            return

        authorization = _header(scope, "authorization")
        if authorization and authorization.lower().startswith("bearer "):
            if authorization[len("bearer ") :].strip():
                await self.app(scope, receive, send)
                return

        response = JSONResponse(
            status_code=401,
            content={
                "detail": {
                    "code": "missing_api_key",
                    "message": (
                        "Contexta needs an API key. Set the header "
                        "'Authorization: Bearer ctx_live_...' in your MCP client config; "
                        "keys are created under Settings > Developer."
                    ),
                }
            },
            headers={"www-authenticate": _CHALLENGE},
        )
        await response(scope, receive, send)


def _header(scope: Scope, name: str) -> str | None:
    for key, value in scope.get("headers", []):
        if key.decode("latin-1").lower() == name:
            return value.decode("latin-1")
    return None
