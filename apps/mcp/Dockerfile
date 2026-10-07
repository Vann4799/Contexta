FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MCP_PORT=8080 \
    CONTEXTA_API_INTERNAL_URL=http://api:8001

WORKDIR /app

RUN useradd --create-home --uid 1001 contexta

# No packages/rag here: this process never embeds or retrieves, it only speaks to /v1.
COPY apps/mcp ./apps/mcp

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ./apps/mcp

USER contexta
WORKDIR /app/apps/mcp

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"MCP_PORT\", \"8080\")}/health', timeout=3)"

CMD ["python", "-m", "contexta_mcp"]
