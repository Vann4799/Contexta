from __future__ import annotations

import os
from dataclasses import dataclass, field

DEFAULT_API_URL = "http://api:8001"
DEFAULT_PORT = 8080
MCP_PATH = "/mcp"
HEALTH_PATH = "/health"


def _csv(name: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in os.getenv(name, "").split(",") if item.strip())


@dataclass(frozen=True)
class McpSettings:
    """Only three things are configurable: where the API is, the port, and the Host allowlist."""

    api_url: str = DEFAULT_API_URL
    port: int = DEFAULT_PORT
    allowed_hosts: tuple[str, ...] = field(default_factory=tuple)

    @classmethod
    def from_env(cls) -> "McpSettings":
        return cls(
            api_url=os.getenv("CONTEXTA_API_INTERNAL_URL", DEFAULT_API_URL).rstrip("/"),
            port=int(os.getenv("MCP_PORT", str(DEFAULT_PORT))),
            allowed_hosts=_csv("MCP_ALLOWED_HOSTS"),
        )
