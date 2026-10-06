FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8070 \
    EMBEDDING_MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 \
    HF_HOME=/opt/model-cache

WORKDIR /app

RUN useradd --create-home --uid 1001 contexta

# The default PyPI torch wheel bundles CUDA libraries this host has no use for.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch

COPY packages/rag ./packages/rag
COPY apps/embeddings ./apps/embeddings

RUN pip install --no-cache-dir ./packages/rag[local-embeddings] \
    && python -c "import os; from sentence_transformers import SentenceTransformer; SentenceTransformer(os.environ['EMBEDDING_MODEL_NAME'], device='cpu')" \
    && chown -R contexta:contexta /opt/model-cache

USER contexta
WORKDIR /app/apps/embeddings

EXPOSE 8070

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8070\")}/health', timeout=3)"

CMD ["python", "server.py"]
