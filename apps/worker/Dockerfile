FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKER_POLL_INTERVAL=5

WORKDIR /app

RUN useradd --create-home --uid 1001 contexta

COPY packages/rag ./packages/rag
COPY apps/worker ./apps/worker

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ./packages/rag ./apps/worker

USER contexta
WORKDIR /app/apps/worker

CMD ["sh", "-c", "python -m worker.main --poll-interval ${WORKER_POLL_INTERVAL:-5}"]
