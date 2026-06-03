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

```powershell
Push-Location packages/rag
python -m pytest
Pop-Location
```

Run API tests:

```powershell
Push-Location apps/api
python -m pytest
Pop-Location
```

Run worker tests:

```powershell
Push-Location apps/worker
python -m pytest
Pop-Location
```

Run web dev server:

```powershell
Push-Location apps/web
npm install
npm run dev
Pop-Location
```
