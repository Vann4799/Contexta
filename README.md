# Contexta

Contexta is a RAG document chatbot for PDF and DOCX files.

## Apps

- `apps/web`: Next.js frontend.
- `apps/api`: FastAPI API service.
- `apps/worker`: background document processor.
- `packages/rag`: shared Python RAG utilities.

## Local Infrastructure

Start Qdrant:

```bash
docker compose up -d qdrant
```

Qdrant health:

```bash
curl http://localhost:6333/healthz
```

## Phase 1 Commands

Run shared RAG tests:

```bash
cd packages/rag
python -m pytest
```

Run API tests:

```bash
cd apps/api
python -m pytest
```

Run worker tests:

```bash
cd apps/worker
python -m pytest
```

Run web dev server:

```bash
cd apps/web
npm install
npm run dev
```
