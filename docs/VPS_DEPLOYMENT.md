# Contexta VPS Deployment

Use this when the web app is deployed on Vercel and the API, worker, and Qdrant run on your own VPS.

## Requirements

- A VPS with Docker and Docker Compose.
- A domain or subdomain for the API, for example `api.your-domain.com`.
- DNS `A` record for that API domain pointing to the VPS public IP.
- Ports `80` and `443` open on the VPS firewall.

Vercel is HTTPS, so the API must also be HTTPS. The production compose stack includes Caddy to issue and renew HTTPS certificates automatically.

## Files

- `docker-compose.prod.yml`: API, worker, Qdrant, and Caddy.
- `.env.production.example`: copy to `.env.production` on the VPS.
- `deploy/vps/Caddyfile`: HTTPS reverse proxy to the API container.

## First Deploy

On the VPS:

```bash
git clone https://github.com/Vann4799/Contexta.git
cd Contexta
cp .env.production.example .env.production
```

Edit `.env.production` and fill real values:

```bash
nano .env.production
```

Required values:

```text
API_DOMAIN=api.your-domain.com
API_CORS_ORIGINS=https://web-hazel-beta-36.vercel.app
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
SUPABASE_JWKS_URL=...
SUPABASE_STORAGE_BUCKET=contexta-documents
QDRANT_API_KEY=...
QDRANT__SERVICE__API_KEY=...
DEEPSEEK_API_KEY=...
```

Use the same secret value for `QDRANT_API_KEY` and `QDRANT__SERVICE__API_KEY`.

Start the stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check services:

```bash
docker compose -f docker-compose.prod.yml ps
curl https://api.your-domain.com/health
curl https://api.your-domain.com/health/indexing
```

## Connect Vercel Web to VPS API

After the VPS API is healthy, set Vercel production env:

```bash
cd apps/web
npx vercel env add NEXT_PUBLIC_API_BASE_URL production
```

Use:

```text
https://api.your-domain.com
```

Then redeploy:

```bash
npx vercel deploy --prod --yes
```

## Supabase Auth Redirects

In Supabase Auth URL settings, add:

```text
https://web-hazel-beta-36.vercel.app/auth/callback
```

Also set the site URL to:

```text
https://web-hazel-beta-36.vercel.app
```

## Update Later

On the VPS:

```bash
cd Contexta
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Retrieval upgrade (Wave 2)

Order matters: `0002_document_metadata.sql` must exist before the new api and
worker run, because they read and write the `doc_type`, `section_path` and
`token_count` columns that PostgREST rejects otherwise.

These steps need the Wave 2 commits pushed to GitHub first.

```bash
cd Contexta
git pull

# 1. Apply the metadata migration (Supabase dashboard: SQL editor, or `supabase db push`)
#    infra/supabase/migrations/0002_document_metadata.sql

# 2. Point the corpus at a NEW collection instead of reusing contexta_chunks,
#    then rebuild. The embeddings container is what holds the model.
sed -i 's/^QDRANT_COLLECTION=.*/QDRANT_COLLECTION=contexta_chunks_v2/' .env.production
docker compose -f docker-compose.prod.yml up -d --build

# 3. Re-index every document with the new chunker and model
docker compose -f docker-compose.prod.yml exec worker python -m worker.reindex --all

# 4. Confirm retrieval actually improved before letting users back in
docker compose -f docker-compose.prod.yml exec api python evals/retrieval_eval.py --compare evals/results/baseline.json
```

Step 3 writes into `contexta_chunks_v2`; the old `contexta_chunks` keeps
serving until `QDRANT_COLLECTION` is switched, so rollback is the previous
collection plus the previous `chunker_version`. Delete the old collection only
after the eval numbers hold for a few days.

A reindex that fails on one document leaves that document readable from its
previous index; the command prints the failure and exits non-zero, so re-run
it with `--document-id` after fixing the cause.

## Logs

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f caddy
```

## Notes

- Qdrant is not exposed publicly; only API and worker can reach it inside the Docker network.
- `QDRANT_API_KEY` and `QDRANT__SERVICE__API_KEY` should use the same value. API and worker send `QDRANT_API_KEY`; Qdrant reads `QDRANT__SERVICE__API_KEY`.
- Do not commit `.env.production`.
