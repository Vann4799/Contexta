# Contexta

Contexta is a RAG document chatbot for PDF and DOCX files.

## Status

Contexta is currently an MVP for a single-user document intelligence workspace. It supports:

- Supabase email auth.
- PDF and DOCX uploads.
- background indexing into Qdrant.
- grounded chat with citations.
- document intelligence pages.
- PDF to Markdown conversion with MarkItDown.

## Apps

- `apps/web`: Next.js frontend.
- `apps/api`: FastAPI API service.
- `apps/worker`: background document processor.
- `packages/rag`: shared Python RAG utilities.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before publishing or deploying. The first public release should use:

- Vercel or another Node host for `apps/web`.
- a Docker host for `apps/api`.
- one separate worker service for `apps/worker`.
- Supabase hosted Auth/Database/Storage.
- Qdrant Cloud or a private Qdrant service.

Never commit real `.env` files or API keys.

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

## Verification

Phase 1 is considered healthy when:

- Qdrant responds at `http://localhost:6333/healthz`.
- `packages/rag` tests pass.
- `apps/api` tests pass.
- `apps/worker` tests pass.
- `apps/web` lint and build pass.

## Supabase Setup

Phase 2 adds Supabase Auth and metadata schema. Apply the SQL in:

```text
infra/supabase/migrations/0001_initial_schema.sql
```

The frontend expects:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_AUTH_CALLBACK_URL
```

The API expects:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
SUPABASE_JWKS_URL
SUPABASE_STORAGE_BUCKET
QDRANT_URL
QDRANT_API_KEY
QDRANT_COLLECTION
DEEPSEEK_API_KEY
API_CORS_ORIGINS
```

## Phase 2 Verification

Phase 2 is healthy when:

- Supabase migration contract tests pass.
- API auth and document metadata tests pass.
- Existing worker and RAG tests still pass.
- Web lint and build pass.

Manual Supabase verification requires real project credentials in `.env` files and applying `infra/supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor.

## Phase 3 Verification

Phase 3 is healthy when:

- API upload tests pass.
- Web lint and build pass.
- A signed-in user can upload a PDF or DOCX from `/documents`.
- Supabase Storage receives the file under `contexta-documents/<user_id>/...`.
- Supabase `documents` receives a metadata row with status `processing`.
