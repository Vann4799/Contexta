from __future__ import annotations

import uvicorn

from .config import McpSettings
from .server import build_app


def main() -> None:
    settings = McpSettings.from_env()
    uvicorn.run(build_app(settings), host="0.0.0.0", port=settings.port, log_level="info")


if __name__ == "__main__":
    main()
