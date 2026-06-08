# Contexta Deployment Guide

This guide is for a first public MVP release. Keep Supabase service role keys, DeepSeek keys, JWT secrets, and Qdrant credentials out of Git.

## Recommended First Release Topology

- Web: Vercel, deployed from `apps/web`.
- API: Render, Railway, Fly.io, or any Docker host using `apps/api/Dockerfile`.
- Worker: a separate background worker service using `apps/worker/Dockerfile`.
- Database/Auth/Storage: hosted Supabase.
- Vector database: Qdrant Cloud or a private Qdrant container.

Run only one worker instance for the first public release. The current worker is a polling worker and should not be horizontally scaled until row claiming is made atomic.

## GitHub Publish Safety

Do not push:

- `.env`, `apps/api/.env`, `apps/web/.env.local`, or any real secret file.
- `UI/` Stitch reference exports.
- local planning drafts such as `01_PRD.md` through `05_TASK_BREAKDOWN.md`.
- `tests/artifacts/`, screenshots, `.qdrant/`, `.next/`, `node_modules/`, or caches.

These paths are ignored by `.gitignore` and `.dockerignore`.

## Production Environment Variables

### API and Worker

Set these in the API service and worker service:

```text
ENVIRONMENT=production
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>
SUPABASE_JWT_SECRET=<legacy jwt secret, or set SUPABASE_JWKS_URL>
SUPABASE_JWKS_URL=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_STORAGE_BUCKET=contexta-documents
QDRANT_URL=https://<qdrant-host>
QDRANT_COLLECTION=contexta_chunks
DEEPSEEK_API_KEY=<deepseek key>
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_MAX_TOKENS=3500
EMBEDDING_PROVIDER=deterministic
EMBEDDING_DIMENSIONS=384
API_CORS_ORIGINS=https://<web-domain>
```

Optional worker setting:

```text
WORKER_POLL_INTERVAL=5
```

### Web

Set these in the web host:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
NEXT_PUBLIC_API_BASE_URL=https://<api-domain>
NEXT_PUBLIC_AUTH_CALLBACK_URL=https://<web-domain>/auth/callback
```

In Supabase Auth settings, add these redirect URLs:

```text
https://<web-domain>/auth/callback
http://localhost:3000/auth/callback
```

## Supabase Setup

1. Create a Supabase project.
2. Apply `infra/supabase/migrations/0001_initial_schema.sql`.
3. Confirm the private storage bucket `contexta-documents` exists.
4. Confirm RLS is enabled on public tables and storage policies are present.
5. Create a normal user through the app or Supabase Auth.

## Docker Build Commands

Build API from the repository root:

```bash
docker build -f apps/api/Dockerfile -t contexta-api .
```

Run API:

```bash
docker run --env-file .env -p 8001:8001 contexta-api
```

Build worker from the repository root:

```bash
docker build -f apps/worker/Dockerfile -t contexta-worker .
```

Run worker:

```bash
docker run --env-file .env contexta-worker
```

## Release Checks

Run before pushing or deploying:

```powershell
Push-Location packages/rag
python -m pytest
Pop-Location

Push-Location apps/api
python -m pytest
Pop-Location

Push-Location apps/worker
python -m pytest
Pop-Location

Push-Location apps/web
npm ci
npm run lint
npm run build
Pop-Location
```

After deploying, run authenticated smoke tests against production with test credentials in environment variables or a dedicated QA Supabase user.

## Health Checks

API endpoints:

```text
GET /health
GET /health/vector
GET /health/indexing
```

Use `/health` for platform liveness and `/health/indexing` for worker queue visibility.

## First Release Caveats

- Keep worker replicas at `1`.
- Use managed Qdrant or a private Qdrant service, not a public unauthenticated container.
- Do not expose Supabase service role keys to the web app.
- Rotate any secret that was ever pasted into chat, screenshots, or public issue trackers.
