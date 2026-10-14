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
- `deploy/vps/caddy-guard.sh`: cron guard that validates that Caddyfile and rolls it back when Caddy refuses it.

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

## Retiring the raw-IP hostname (Cloudflare cutover)

The API is currently published as `api.<VPS-IP>.sslip.io`. The hostname carries the origin IP, so
anyone can connect to `https://<VPS-IP>` directly and bypass whatever edge protection sits in front
of the domain. Until this section is done, treat the VPS IP as public knowledge.

Steps 1, 2 and 7 need Cloudflare and registrar access, so they are the owner's to run.

1. Add `contexta.my.id` as a zone in Cloudflare and move the nameservers at the registrar.
2. Create an `A` record `api` pointing at the VPS IP as **DNS only** for now (grey cloud).
   Keep ports `80`/`443` reachable as the Requirements section asks for.
3. On the VPS, swap the hostname the stack answers for, in `.env.production`:

   ```text
   API_DOMAIN=api.contexta.my.id
   MCP_ALLOWED_HOSTS=api.contexta.my.id
   ```

   `deploy/vps/Caddyfile` is parameterized on `{$API_DOMAIN}`, so this is the only change Caddy
   needs. Do the cutover while the record is still DNS-only: Caddy must complete a Let's Encrypt
   HTTP-01 challenge for the new name before any proxying is involved.

   ```bash
   git pull
   docker compose -f docker-compose.prod.yml up -d --build
   curl -i https://api.contexta.my.id/health
   ```

4. Switch the record to **Proxied** (orange cloud). In Cloudflare: SSL/TLS mode `Full (strict)`,
   `Always Use HTTPS` on, WAF managed rulesets on, and a rate-limiting rule on `/v1/*` and `/chat`.
5. Point the web app at the new host and redeploy:

   ```bash
   npx vercel env add NEXT_PUBLIC_API_BASE_URL production        # https://api.contexta.my.id
   npx vercel env add NEXT_PUBLIC_PUBLIC_API_BASE_URL production
   npx vercel deploy --prod
   ```

6. In Supabase → Authentication → URL Configuration, replace every sslip.io entry in Site URL and
   Redirect URLs with `https://api.contexta.my.id`.
7. Close the origin. In the AWS security group, replace `0.0.0.0/0` on ports 80/443 with the
   published Cloudflare IPv4 ranges (<https://www.cloudflare.com/ips/>), and keep port 22 limited
   to your own IP. This is the step that actually removes the direct-IP bypass.

Verify:

```bash
curl -i https://api.contexta.my.id/health         # 200
curl -i --max-time 10 -k https://<VPS-IP>/health  # must time out or refuse
```

If the second command still answers, the security group change did not land.

**On the proxy-side rate limit.** The stock `caddy:2.8-alpine` image has no `rate_limit` directive —
it ships as a plugin build, so the "at minimum, rate-limit at Caddy" fallback is not available here
without swapping the image. Today the only limiters in the stack are the API's own: 60 requests per
minute per API key and the daily LLM budgets, both of which key on a credential. A flood that never
presents one reaches the origin unchecked, which is the concrete reason Cloudflare belongs in front.

**On the "one instance, no load balancer" observation.** That is a capacity decision, not a
misconfiguration: `api` is stateless (Postgres, Qdrant and the object store all run outside the
container), so a second replica behind a load balancer is the scaling path when measured load
requires it. Cloudflare in front already absorbs volumetric attacks and caches static responses,
which covers the availability half of the finding without adding a node.

## Caddy crash-loop guard

`deploy/vps/caddy-guard.sh` is the on-box half of the uptime work. The outside-in alarm is the
`Uptime` workflow, documented under "Uptime Monitoring" in `docs/DEPLOYMENT.md`.

It exists because of the `rate_limit` note above. That directive makes `caddy validate` fail on the
stock image, so Caddy exits on start and Docker restarts it forever. `restart: unless-stopped` keeps
the container listed in `docker ps`, with `Restarting` in the status column, which is how three
minutes of a completely unreachable API looked like a healthy box.

Each run, as `ubuntu`, does this:

1. Stops unless `docker info` answers. Nothing is guessed when Docker is not reachable.
2. Validates the Caddyfile on disk, passing `--env-file .env.production` because the site address is
   `{$API_DOMAIN}` and validating without it can fail a good file.
3. When it validates, copies it over the last-known-good file whenever the two differ.
4. When it does not, writes the last-known-good file back and applies it: `caddy reload` inside the
   container while the container is up, which costs no connections, and
   `docker compose up -d --no-deps caddy` when the container is crash-looping. `--no-deps` is what
   keeps the repair from also restarting api, worker, qdrant, embeddings and mcp.
5. When the file validates but the container is crash-looping, it compares the checksum of the
   Caddyfile on disk against the bytes the container actually holds. Those differ only when the bind
   mount and the path have drifted apart, so the mount is the bad one and gets rewritten. When they
   match, the crash is not the Caddyfile's doing and the guard stops with exit 1 rather than
   recreating a proxy every minute and burying the real cause under guard churn.
   It does not read the logs to decide: Caddy keeps its last config error in the log window across a
   restart that succeeded, so a log match would revert a file that currently validates.

The last-known-good file is `~/.contexta/caddy-guard/Caddyfile.known-good`, deliberately outside the
checkout. `/opt/contexta/deploy/vps/Caddyfile` is tracked, so `git pull` replaces whatever is written
there. A sibling untracked file would survive `git pull` but not `git clean -fdx` or a re-clone, and it
invites committing a second Caddyfile that silently diverges from the one Caddy reads. `~/.contexta`
needs no root, and no command in this document writes to it.

The rollback is a `cp` into the existing file, never a temp file plus rename. The Caddyfile is a
single-file bind mount, and a bind mount keeps following the inode it was created from, so renaming a
new file over the path leaves the container reading the old inode while the host path shows the fixed
file. The same rule is why a manual recovery rewrites in place:

```bash
cd /opt/contexta && git show HEAD:deploy/vps/Caddyfile > deploy/vps/Caddyfile
```

### Install the cron entry

As `ubuntu` on the VPS:

```bash
cd /opt/contexta
chmod +x deploy/vps/caddy-guard.sh
./deploy/vps/caddy-guard.sh; echo "exit=$?"      # first run seeds the backup
```

Then the schedule. This form re-runs without duplicating the line and leaves any other entry alone:

```bash
{ crontab -l 2>/dev/null | grep -vF 'caddy-guard.sh'; \
  echo '* * * * * /opt/contexta/deploy/vps/caddy-guard.sh >> /home/ubuntu/.contexta/caddy-guard/cron.log 2>&1'; } | crontab -
crontab -l
```

Cron sets `HOME` from `/etc/passwd`, which is how the guard finds `~/.contexta` without being told.
Add `MAILTO=name@example.com` above the entry if you want the refusal cases mailed; exit 1 always
means "a person has to look". The guard writes to `~/.contexta/caddy-guard/caddy-guard.log` and logs
nothing on a healthy minute, so an idle run costs one `docker run --rm` validation plus a rewrite of
its own 30-byte capture file.

### Rehearse it

Point every path at a scratch tree and use a container name that does not exist, so no container
command can reach `contexta-caddy`:

```bash
mkdir -p /tmp/guard-test/deploy/vps /tmp/guard-state
printf 'API_DOMAIN=api.rehearsal.test\n' > /tmp/guard-test/.env.production
printf 'services: {}\n' > /tmp/guard-test/docker-compose.prod.yml
cp /opt/contexta/deploy/vps/Caddyfile /tmp/guard-test/deploy/vps/Caddyfile

GUARD_ENV="REPO_DIR=/tmp/guard-test COMPOSE_FILE=/tmp/guard-test/docker-compose.prod.yml ENV_FILE=/tmp/guard-test/.env.production CADDYFILE=/tmp/guard-test/deploy/vps/Caddyfile STATE_DIR=/tmp/guard-state CONTAINER=guard-rehearsal-absent SERVICE=guard-rehearsal-absent"
env $GUARD_ENV /opt/contexta/deploy/vps/caddy-guard.sh      # seeds /tmp/guard-state/Caddyfile.known-good

# break it the way the incident did, then run the same command again
printf '{$API_DOMAIN} {\n  encode gzip\n  rate_limit {\n    window 1m\n  }\n}\n' > /tmp/guard-test/deploy/vps/Caddyfile
env $GUARD_ENV /opt/contexta/deploy/vps/caddy-guard.sh

diff /tmp/guard-test/deploy/vps/Caddyfile /tmp/guard-state/Caddyfile.known-good   # no output means the rollback worked
rm -rf /tmp/guard-test /tmp/guard-state
```

Expect a non-zero exit on the second run: the rollback of the file is what is being proved, and the
final compose step cannot succeed because the scratch compose file declares no services. That failure
is also the safety property — the rehearsal cannot recreate anything real.

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
