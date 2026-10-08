# Contexta Deployment Guide

This guide is for a first public MVP release. Keep Supabase service role keys, DeepSeek keys, JWT secrets, and Qdrant credentials out of Git.

## Recommended First Release Topology

- Web: Vercel, deployed from `apps/web`.
- API: Render Docker web service using `apps/api/Dockerfile`.
- Worker: Render Docker background worker using `apps/worker/Dockerfile`.
- Database/Auth/Storage: hosted Supabase.
- Vector database: Qdrant Cloud or a private Qdrant container.

Run only one worker instance for the first public release. The current worker is a polling worker and should not be horizontally scaled until row claiming is made atomic.

## Vercel Web Deployment

1. Import `https://github.com/Vann4799/Contexta` into Vercel.
2. Set the Vercel project root directory to `apps/web`.
3. Keep the framework preset as Next.js. `apps/web/vercel.json` sets `npm ci` and `npm run build`.
4. Add these Vercel environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
NEXT_PUBLIC_API_BASE_URL=https://<render-api-domain>
NEXT_PUBLIC_AUTH_CALLBACK_URL=https://<vercel-web-domain>/auth/callback
```

5. Deploy once. Copy the Vercel production domain.
6. Add that domain to `API_CORS_ORIGINS` in Render.
7. Add `https://<vercel-web-domain>/auth/callback` to Supabase Auth redirect URLs.

## Render API and Worker Deployment

`render.yaml` defines:

- `contexta-api`: Docker web service, health checked at `/health`.
- `contexta-worker`: Docker background worker, one instance only.
- `contexta-production`: shared env group with secrets marked `sync: false`.

Steps:

1. In Render, create a new Blueprint from `https://github.com/Vann4799/Contexta`.
2. Render will detect `render.yaml`.
3. Fill every `sync: false` value in the `contexta-production` env group.
4. Set `API_CORS_ORIGINS` to the deployed Vercel domain, for example:

```text
https://contexta.vercel.app
```

5. Deploy `contexta-api`.
6. Deploy `contexta-worker`.
7. Open `https://<render-api-domain>/health` and `https://<render-api-domain>/health/indexing`.

If the Render API domain changes, update `NEXT_PUBLIC_API_BASE_URL` in Vercel and redeploy the web app.

## GitHub Publish Safety

Do not push:

- `.env`, `apps/api/.env`, `apps/web/.env.local`, or any real secret file.
- `UI/` Stitch reference exports.
- local planning drafts such as `01_PRD.md` through `05_TASK_BREAKDOWN.md`.
- `tests/artifacts/`, screenshots, `.qdrant/`, `.next/`, `node_modules/`, or caches.

These paths are ignored by `.gitignore` and `.dockerignore`.

## Production Environment Variables

### API and Worker / Render Env Group

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
QDRANT_API_KEY=<qdrant api key, blank only for private unauthenticated Qdrant>
QDRANT_COLLECTION=contexta_chunks
DEEPSEEK_API_KEY=<deepseek key>
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_MAX_TOKENS=3500
DEEPSEEK_REWRITE_MODEL=deepseek-chat
EMBEDDING_PROVIDER=deterministic
EMBEDDING_DIMENSIONS=384
API_CORS_ORIGINS=https://<vercel-web-domain>
```

`DEEPSEEK_REWRITE_MODEL` resolves a follow-up question into a standalone search query before
retrieval. It is not yet written to `.env.production`, and it does not need to be: the code default
above plus an existing `DEEPSEEK_API_KEY` means the rewrite is live as soon as the api image is
rebuilt. To switch it off without a code change, set `DEEPSEEK_REWRITE_MODEL=` to an empty value and
restart the api service; follow-ups then search with the raw question.

Optional api quota:

```text
LLM_DAY_LIMIT=200
```

`LLM_DAY_LIMIT` caps the paid DeepSeek calls one user can trigger per UTC day across chat answers
and document briefs; past the cap the endpoints answer `429 llm_day_limit_exceeded` with a
`Retry-After` until midnight UTC. Questions served without a model call (exact-count and
highest-metric answers, insufficient-context replies) cost nothing, and a declined rewrite never
reaches the model. The counter is in-process and approximate: it is per worker process, reset by a
restart or scale change, and is a cost brake rather than billing. Set it to `0` to meter nothing at
all. The only durable quota stays the per-key daily limit behind `/v1`.

Optional worker setting:

```text
WORKER_POLL_INTERVAL=5
```

### Web / Vercel

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
- If using Qdrant Cloud, set `QDRANT_API_KEY` for both API and worker.
- Do not expose Supabase service role keys to the web app.
- Rotate any secret that was ever pasted into chat, screenshots, or public issue trackers.
