# Contexta

Contexta is a RAG document chatbot for PDF and DOCX files.

## Status

Contexta is a multi-user document intelligence workspace. It supports:

- Supabase email auth (JWKS-based token verification).
- PDF and DOCX uploads with background indexing into Qdrant.
- Hybrid retrieval across named vector spaces (dual embedding arms, RRF fusion).
- Grounded chat with query rewriting and clickable section citations.
- Document intelligence pages, PDF to Markdown conversion, corpus export.
- Developer API keys with minute/day quotas (`/v1` endpoints) and an MCP server.
- English/Indonesian UI.

## Apps

- `apps/web`: Next.js frontend.
- `apps/api`: FastAPI API service (serves `/v1`, `/mcp` proxying, health endpoints).
- `apps/worker`: background document processor (chunking, embeddings, Qdrant upsert, log pruning).
- `apps/embeddings`: optional sidecar that serves local embedding models to the worker.
- `apps/mcp`: MCP server forwarding tool calls to the API's `/v1` endpoints.
- `packages/rag`: shared Python RAG utilities (chunker, storage helpers, retrieval).

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the Render + Vercel blueprint setup, or [docs/VPS_DEPLOYMENT.md](docs/VPS_DEPLOYMENT.md) for a Docker Compose deployment on a VPS.

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

## Tests

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

Run MCP tests:

```powershell
Push-Location apps/mcp
python -m pytest
Pop-Location
```

Run embeddings tests:

```powershell
Push-Location apps/embeddings
python -m pytest
Pop-Location
```

Run web dev server and type checks:

```powershell
Push-Location apps/web
pnpm install
pnpm run dev
pnpm exec tsc --noEmit
Pop-Location
```

The stack is healthy when all Python test suites pass and the web type check is clean.

## Supabase Setup

Apply the SQL in `infra/supabase/migrations/` in order:

1. `0001_initial_schema.sql`
2. `0002_document_metadata.sql`
3. `0003_api_keys.sql`
4. `0004_account_summary.sql`

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
SUPABASE_JWKS_URL            # optional; derived from SUPABASE_URL when unset
SUPABASE_STORAGE_BUCKET
QDRANT_URL
QDRANT_API_KEY
QDRANT_COLLECTION
DEEPSEEK_API_KEY
API_CORS_ORIGINS
EMBEDDING_*                  # primary retrieval arm (see docs/DEPLOYMENT.md)
SECONDARY_EMBEDDING_*        # optional second retrieval arm
```

The worker expects:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
QDRANT_URL
QDRANT_API_KEY
QDRANT_COLLECTION
EMBEDDING_*                  # primary arm
SECONDARY_EMBEDDING_*        # optional second arm
MAX_CHUNK_WORDS / CHUNK_OVERLAP_WORDS / MIN_CHUNK_WORDS   # optional tuning
API_LOG_RETENTION_DAYS       # optional; default 90
```

## Verification

A manual end-to-end check after deploying:

- Qdrant responds on its health endpoint and `/health/vector` reports the live collection and arms.
- A signed-in user can upload a PDF or DOCX from `/documents`; the row lands in Supabase Storage under `contexta-documents/<user_id>/...` and the document reaches status `ready`.
- Chat answers with section citations and rate-limit headers the UI can read.
- `/v1` endpoints authorize with a developer API key, and the MCP server at `/mcp` forwards tool calls to them.
