FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001

WORKDIR /app

RUN useradd --create-home --uid 1001 contexta

COPY packages/rag ./packages/rag
COPY apps/api ./apps/api

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ./packages/rag ./apps/api

USER contexta
WORKDIR /app/apps/api

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8001\")}/health', timeout=3)"

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001} --proxy-headers --forwarded-allow-ips='*'"]
