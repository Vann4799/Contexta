# Contexta Deployment Guide

This guide is for a first public MVP release. Keep Supabase service role keys, DeepSeek keys, JWT secrets, and Qdrant credentials out of Git.

## Recommended First Release Topology

- Web: Vercel, deployed from `apps/web`.
- API: Render Docker web service using `apps/api/Dockerfile`.
- Worker: Render Docker background worker using `apps/worker/Dockerfile`.
- Embeddings: Render Docker web service using `apps/embeddings/Dockerfile`; it serves the primary MiniLM arm that both the API and the worker call over HTTP.
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
- `contexta-embeddings`: Docker web service hosting the primary embedding model, health checked at `/health`. `EMBEDDING_REMOTE_URL` for the API and worker is wired to it automatically via `fromService`.
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
QDRANT_COLLECTION=contexta_chunks_v3
DEEPSEEK_API_KEY=<deepseek key>
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_MAX_TOKENS=3500
DEEPSEEK_REWRITE_MODEL=deepseek-chat
EMBEDDING_PROVIDER=remote
EMBEDDING_MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
EMBEDDING_DIMENSIONS=384
EMBEDDING_VECTOR_NAME=minilm
EMBEDDING_REMOTE_URL=<wired from the contexta-embeddings service by render.yaml>
SECONDARY_EMBEDDING_PROVIDER=openrouter
SECONDARY_EMBEDDING_BASE_URL=https://openrouter.ai/api/v1
SECONDARY_EMBEDDING_MODEL_NAME=openai/text-embedding-3-small
SECONDARY_EMBEDDING_DIMENSIONS=1536
SECONDARY_EMBEDDING_VECTOR_NAME=openai
SECONDARY_EMBEDDING_API_KEY=<openrouter key>
RETRIEVAL_ARM_WINDOW=10
API_CORS_ORIGINS=https://<vercel-web-domain>
```

Outside development or test the API refuses to boot while `SUPABASE_JWT_SECRET` still holds the
shipped default, unless `SUPABASE_JWKS_URL` is explicitly set. A JWKS URL derived from
`SUPABASE_URL` does not satisfy that guard — the operator must fill at least one of the two auth
values marked `sync: false` above. Access tokens are additionally verified against the issuer the
JWKS URL implies (`https://<project-ref>.supabase.co/auth/v1`), so a token from a different
Supabase project is rejected even when the signing key verifies.

`DEEPSEEK_REWRITE_MODEL` resolves a follow-up question into a standalone search query before
retrieval. It is not yet written to `.env.production`, and it does not need to be: the code default
above plus an existing `DEEPSEEK_API_KEY` means the rewrite is live as soon as the api image is
rebuilt. To switch it off without a code change, set `DEEPSEEK_REWRITE_MODEL=` to an empty value and
restart the api service; follow-ups then search with the raw question.

Optional api quotas:

```text
LLM_DAY_LIMIT=200
BRIEF_DAY_LIMIT=100
```

`LLM_DAY_LIMIT` caps the paid DeepSeek calls one user can trigger per UTC day through chat;
past the cap the endpoints answer `429 llm_day_limit_exceeded` with a
`Retry-After` until midnight UTC. Questions served without a model call (exact-count and
highest-metric answers, insufficient-context replies) cost nothing, and a declined rewrite never
reaches the model.

`BRIEF_DAY_LIMIT` is the same cap for `POST /documents/{id}/brief`, counted separately so a few
briefs can never lock a user out of chatting. One brief costs one call per sampled section plus one
merge call, so a long document can spend up to five units; it is a call allowance, not a click one.

Both counters are in-process and approximate: per worker process, reset by a restart or scale
change, and a cost brake rather than billing. Set either to `0` to meter nothing there.
The only durable quota stays the per-key daily limit behind `/v1`.

The cost ledger (`llm_calls`, read back through `GET /usage/llm`) prices tokens from two JSON maps
keyed by the model id the request goes out with:

```text
LLM_PRICE_INPUT_PER_MILLION={"deepseek-v4-pro":0.66}
LLM_PRICE_OUTPUT_PER_MILLION={"deepseek-v4-pro":1.98}
```

A model with no entry, or with an entry on only one side, is stored with a null cost rather than a
borrowed one, so switching `DEEPSEEK_MODEL` means adding it to both maps before the ledger can say
what it costs. Setting either variable replaces that whole map, not just the one key, so carry the
other models across with it. These are quoted rates, and DeepSeek's peak hours cost roughly double,
which makes a derived `cost_usd` a floor; a gateway that reports its own price (OpenRouter does) is
stored under `cost_basis = provider` and wins over the map.

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
2. Apply every file in `infra/supabase/migrations` in numeric order (`0001` .. `0013`). A
   migration must land before the code that reads its column is deployed: `0011_document_brief.sql`
   adds `documents.ai_brief`, and `GET /documents/{id}/intelligence` selects that column, so an
   un-migrated database returns 500 for every document. `0013_llm_calls.sql` fails differently --
   the API inserts a cost-ledger row after each completion and deliberately swallows that write,
   so a missing `llm_calls` table costs no user their answer and leaves the ledger empty instead.
   `GET /usage/llm` is where the missing table becomes visible.
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

## Uptime Monitoring

`.github/workflows/uptime.yml` probes production from outside the stack every 5 minutes and pages
over Telegram. It exists because a Caddy crash loop made the API unreachable for about three minutes
with nothing recording it: `docker ps` was still listing the container. The on-box companion is
`deploy/vps/caddy-guard.sh`, described in `docs/VPS_DEPLOYMENT.md`.

What it checks:

```text
GET https://api.contexta.my.id/health          200 and a body containing "service":"contexta-api"
GET https://api.contexta.my.id/health/vector    200 and a body containing "status":"ok"
GET https://contexta.my.id/robots.txt                 200
```

The body has to match, not only the status code, because a 200 from a TLS-terminating middlebox is
not the API answering. Two endpoints are left alone on purpose: `/health/indexing` is behind
`get_current_user` and answers 401 to an anonymous caller, so paging on it would page on a healthy
system, and `/docs`, `/redoc` and `/openapi.json` are 404 in production by design.

### Secrets

GitHub -> `Vann4799/Contexta` -> Settings -> Secrets and variables -> Actions -> Repository secrets:

```text
TELEGRAM_BOT_TOKEN   the token @BotFather gives you for /newbot
TELEGRAM_CHAT_ID     numeric id of the chat to page; negative for a channel
```

Both are set. To make (or re-make) a bot: @BotFather -> `/newbot`, then send any message to it and
open `https://api.telegram.org/bot<token>/getUpdates` to read `chat.id`. To page a channel, create
it and add the bot as an administrator, otherwise Telegram answers `403`. Replacing a revoked token
only means overwriting the secret; the workflow reads it per run and needs no redeploy.

To prove the whole page path without an outage: Actions -> Uptime -> **Run workflow** -> tick
`send_test`. That dispatches a real probe run and replaces the message body with a clearly-labelled
"Contexta monitor TEST", so the channel can be trusted later when it says DOWN. A run in this mode
cannot page on its own: if Telegram returns anything but 200 the step emits its `::error::`
annotation exactly as it would during an incident.

Careful when sending the same text by hand from a Windows shell: `curl --data-urlencode` there can
produce `Bad Request: text must be encoded in UTF-8` for the `•` and `—` characters, which says
nothing about the workflow. The runner is Linux and posts the same body as UTF-8 without complaint;
reproduce it with `--data-binary @file.json` and a JSON body written as UTF-8.

With either secret missing the workflow still runs and still reports: it writes the probe table to the
run summary and emits a `::error::` annotation saying which secret is absent, and exits without
calling Telegram. Nothing fails on an empty secret, so an outage is visible in the Actions tab even
before the bot exists.

### When it pages

| situation | result |
| --- | --- |
| one failed run | `::warning::` annotation, run goes red, no page |
| two consecutive failed runs, about 10 minutes | Telegram message, run red |
| a third failed run and beyond | run stays red, no repeat page |
| first passing run after a page | Telegram message saying RECOVERED, with the failing targets |

Two consecutive runs is the floor because one timeout is not an outage: a single 15-second curl can
fail on a bad route while the site is fine, and the incident this covers outlived several probes. A
single failing run never pages, so the worst case for a real outage is discovery at the 10-minute
mark. The streak needs somewhere to live and Actions gives a job no filesystem between runs, so it is
read back from this workflow's own run history through the Actions API with the built-in
`GITHUB_TOKEN`.
That is why a failing probe has to leave the run red even when it does not page: the next run counts
those. Only a `failure` conclusion extends the streak; a cancelled or skipped run breaks it, so
runner infrastructure never pages you.

To test the page path by hand: dispatch the workflow from the Actions tab and read the run summary.
To see an actual page, change `API_BASE` in the workflow to an unreachable host on a branch, push it,
and dispatch twice; the first run warns, the second messages. Revert before merging.

### What it does not guarantee

This is a scheduled job, not a monitor. GitHub delays scheduled workflows during busy periods and can
drop runs outright, so the 5 minutes is a target, not a period. If the Actions service itself is
degraded, or the repository goes 60 days without activity on a private plan, which makes GitHub
switch schedules off, there is no alarm and no notice of its absence. Detection is 5 to 10 minutes,
never seconds. The web probe is `robots.txt`, which Vercel can answer from the edge cache, so a green
web row says the edge is serving, not that a page renders. And the probe only covers the three URLs
above: an endpoint that is up but wrong, other than the two body matches, looks healthy.

## First Release Caveats

- Keep worker replicas at `1`.
- Use managed Qdrant or a private Qdrant service, not a public unauthenticated container.
- If using Qdrant Cloud, set `QDRANT_API_KEY` for both API and worker.
- Do not expose Supabase service role keys to the web app.
- Rotate any secret that was ever pasted into chat, screenshots, or public issue trackers.
