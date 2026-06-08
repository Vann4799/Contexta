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
