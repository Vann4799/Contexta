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

`api.<VPS-IP>.sslip.io` carries the origin IP, so anyone who reads it can reach the origin directly
and skip whatever edge protection sits in front of the domain. The replacement is
`api.contexta.my.id`, proxied through Cloudflare, with the origin's `80`/`443` closed to everything
except Cloudflare's ranges.

Measured on 2026-10-14, which narrowed what this cutover actually had to fix:

- `ss -tlnp` shows only `22`, `80` and `443` bound on the host. `api` (8001), `embeddings` (8070),
  `mcp` (8080) and `qdrant` (6333-6334) are published to the docker network only, with no host port,
  so there is no extra service to lock down — Caddy is the entire public surface.
- `https://<VPS-IP>/health` does **not** serve the API. The one site block is `{$API_DOMAIN}`, so a
  handshake for the bare IP or any other Host has no certificate to offer and fails. Port 80 answers
  `308` and redirects to the sslip name. The bypass to close is therefore the sslip *hostname*, not a
  working IP-address endpoint.
- `contexta.my.id` is a Cloudflare zone (`arely`/`mitchell.ns.cloudflare.com`). The web hostname (apex
  `A` `76.76.21.21` and `www` CNAME) is **DNS only**, pointed straight at Vercel — the edge settings
  below therefore only ever affect `api`.
- The `DOCKER-USER` chain is empty and present, which is the hook Docker leaves for exactly this, so
  step 7 can be enforced on the box and does not need the AWS console.

Status: steps 1-4 are done. Steps 5-7 (this repo's URLs, Supabase, the origin lock) are open.

1. Done — the zone exists and the nameservers are already on Cloudflare.
2. Done — `A api -> <VPS-IP>`, created as **DNS only** on purpose (see step 3).
3. Done. `.env.production` now answers for both names while the sslip hostname is still in use:

   ```text
   API_DOMAIN=api.contexta.my.id, api.3.27.119.26.sslip.io
   MCP_ALLOWED_HOSTS=api.contexta.my.id, api.3.27.119.26.sslip.io
   ```

   `deploy/vps/Caddyfile` is parameterized on `{$API_DOMAIN}`, so this is the only change Caddy needs.
   The record was still DNS-only when this ran, so Caddy completed a Let's Encrypt HTTP-01 challenge
   for the new name before any proxying was involved — measured `SAN: DNS:api.contexta.my.id`, and the
   sslip hostname kept answering `200` throughout.

   **Caddyfile address parsing is a trap here.** The value above is substituted into the site
   address *before* the Caddyfile is tokenized, so:
   - a bare comma (`a,b`) is a hard runtime error — `Site addresses cannot contain a comma ','`, and
     Caddy crash-loops, i.e. the API goes down;
   - a bare space (`a b`) parses but silently keeps **only the first name**, so the second hostname
     stops answering;
   - the two forms that work are `{$A} {$B}` (two placeholders) or one value using **comma + space**.

   `caddy validate` prints `Valid configuration` for both broken forms. The only check that tells the
   truth is `caddy adapt`, reading the host matcher:

   ```bash
   docker run --rm --env-file /opt/contexta/.env.production \
     -v /opt/contexta/deploy/vps/Caddyfile:/etc/caddy/Caddyfile:ro \
     --entrypoint caddy caddy:2.8-alpine adapt --config /etc/caddy/Caddyfile --adapter caddyfile \
     | grep -o '"host":\[[^]]*\]'      # must list BOTH names
   ```

   Run that gate *before* `up -d`; the crash loop above cost about a minute of downtime, and the
   rollback is `cp -a .env.production.bak <file> && docker compose -f docker-compose.prod.yml up -d caddy`.

   ```bash
   git pull
   docker compose -f docker-compose.prod.yml up -d caddy mcp
   curl -i https://api.contexta.my.id/health
   ```

4. Done — the record is **Proxied**, `ssl=strict`, `always_use_https=on`. Verified from off the box:
   `api.contexta.my.id` resolves to `104.21.25.118`/`172.67.134.52`, `/health` 200 through the proxy,
   `http://` 301s to `https://`, and `/mcp` still answers `401` (auth required, not an edge error).
   The plan on this zone is **Free Website**, which has no rate-limiting rules, so any `/v1/*` or
   `/chat` throttling has to come from the app's own limiter or a plan change.
5. Point the web app and the monitors at the new host, then redeploy:

   ```bash
   npx vercel env rm NEXT_PUBLIC_API_BASE_URL production --yes
   npx vercel env add NEXT_PUBLIC_API_BASE_URL production       # https://api.contexta.my.id
   npx vercel deploy --prod
   ```

   `NEXT_PUBLIC_PUBLIC_API_BASE_URL` is intentionally *not* set; the code fallback in
   `apps/web/lib/api.ts` carries the hostname. Also replaced in-repo: `.github/workflows/uptime.yml`
   (`API_BASE`), `docs/api-v1.md`, `docs/DEPLOYMENT.md`.
6. Replace every sslip.io entry in Supabase → Authentication → URL Configuration (Site URL and
   Redirect URLs). The callback host is the **web** origin (`https://contexta.my.id/auth/callback`),
   never the API host, so nothing there should name `api.` at all.
7. **Last**, and only once nothing legitimate still calls the origin directly. Close `80`/`443` to
   non-Cloudflare sources in `DOCKER-USER`, which Docker evaluates before its own published-port rules
   and which survives `docker compose up`:

   ```bash
   sudo iptables -N CONTEXTA-ORIGIN 2>/dev/null
   sudo iptables -I DOCKER-USER 1 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
   for p in $(curl -s --max-time 15 https://api.cloudflare.com/client/v4/ips | \
              python3 -c 'import sys,json;print(*json.load(sys.stdin)["result"]["ipv4_cidrs"])'); do
     sudo iptables -I CONTEXTA-ORIGIN -s "$p" -j ACCEPT
   done
   sudo iptables -I DOCKER-USER 2 -p tcp -m multiport --dports 80,443 -j CONTEXTA-ORIGIN
   sudo iptables -A DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP
   ```

   Two reasons this cannot move earlier in the order:
   - Vercel prod and the uptime workflow call the API host by name, and a GitHub runner or Vercel
     function is not a Cloudflare IP — locking first would drop live traffic;
   - after the lock, Let's Encrypt can only renew through Cloudflare. `api.contexta.my.id` is proxied,
     so its HTTP-01 request arrives from a Cloudflare range and gets through; the sslip name is **not**
     on Cloudflare, so its renewal would fail. Drop it from `API_DOMAIN` and `MCP_ALLOWED_HOSTS` in the
     same change:

     ```text
     API_DOMAIN=api.contexta.my.id
     MCP_ALLOWED_HOSTS=api.contexta.my.id
     ```

   Port 22 is untouched, so SSH keeps working. `docker compose up` leaves `DOCKER-USER` alone, but a
   **Docker daemon or host restart empties it**, so re-run the block above (or boot it from a systemd
   unit and `netfilter-persistent save`) after any restart of the daemon. The AWS security group is
   the belt-and-braces version of the same rule and is worth narrowing to the Cloudflare ranges too,
   because it does not depend on anything running inside the instance — but it is no longer the only
   way to close this.

Verify:

```bash
# the hostname must work
curl -i https://api.contexta.my.id/health                                  # 200

# the origin must no longer answer for anyone off the Cloudflare ranges. Send the real
# hostname as SNI + Host to the raw IP: this succeeds before the lockdown and must be
# refused after it.
curl -i --max-time 10 --resolve api.contexta.my.id:443:<VPS-IP> https://api.contexta.my.id/health
```

Run both from **off the box**. This host has no NAT hairpinning, so a request to its own public IP
from inside it fails no matter what the firewall does, and a failure there is not evidence.

`curl -k https://<VPS-IP>/health` is not a valid test at any point in this cutover: Caddy has never
served a certificate for the bare IP, so it fails before the lock and after it.

The `--resolve` command answering `200` after step 7 means the lockdown did not land. It is also why
step 7 comes last: while the record is proxied, real traffic arrives from Cloudflare's ranges and this
direct request is only ever made by you.

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
