#!/usr/bin/env bash
#
# caddy-guard.sh -- keep the Contexta reverse proxy out of a crash loop.
#
# Why this exists: deploy/vps/Caddyfile is bind-mounted read-only into caddy:2.8-alpine, and
# that image has no `rate_limit` directive (it ships as a plugin build). One edit using it
# makes `caddy validate` fail, so Caddy exits on start and Docker restarts it forever. Because
# the service is `restart: unless-stopped`, `docker ps` shows `Restarting` next to a live
# looking row, and the entire API goes dark with no other symptom. This guard validates the
# file on disk before Caddy is trusted with it and rolls back to the last configuration that
# provably parsed.
#
# Designed to run from cron every minute, so it is idempotent: a healthy box produces no
# writes and no log lines. It never deletes anything, never touches a volume, never rewrites
# .env.production and never runs git.
#
# Exit codes: 0 = nothing to do, or the proxy was repaired. 1 = it needs a human and did not
# act, so a MAILTO on the cron line turns those cases into mail instead of silence.
#
# Everything below is overridable by environment, which is also how it is tested without Docker.

set -uo pipefail
# No `set -e`: the checks below deliberately act on non-zero results (a failed validate is the
# interesting case, not an error), and errexit would abandon the run at the first one.

REPO_DIR="${REPO_DIR:-/opt/contexta}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env.production}"
CADDYFILE="${CADDYFILE:-$REPO_DIR/deploy/vps/Caddyfile}"
CADDY_IMAGE="${CADDY_IMAGE:-caddy:2.8-alpine}"
SERVICE="${SERVICE:-caddy}"
CONTAINER="${CONTAINER:-contexta-caddy}"
LOG_WINDOW="${LOG_WINDOW:-10m}"

# The backup lives outside the checkout on purpose. $REPO_DIR/deploy/vps/Caddyfile is a tracked
# file, so `git pull` replaces whatever is written there, and a sibling untracked copy would
# survive a pull but not a `git clean -fdx`, a re-clone, or the temptation to commit a second
# diverged Caddyfile. ~/.contexta is writable by the ubuntu user without root and is untouched
# by every command in the deployment guide.
STATE_DIR="${STATE_DIR:-${HOME:-/home/ubuntu}/.contexta/caddy-guard}"
GOOD="$STATE_DIR/Caddyfile.known-good"
LOG_FILE="${LOG_FILE:-$STATE_DIR/caddy-guard.log}"
VALIDATE_LOG="$STATE_DIR/last-validate.log"

mkdir -p "$STATE_DIR" || exit 1

log() {
  # A cron entry outlives the person who added it, so the log rolls itself instead of
  # filling the disk. Truncating this file is the only destructive thing this script does,
  # and it only ever touches the guard's own log.
  if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 262144 ]; then
    tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  fi
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$LOG_FILE"
  printf '%s\n' "$*"
}

bail() {
  log "REFUSE: $*"
  exit 1
}

# Two runs must not stack (a validate takes about a second, but a recreate can take longer than
# the minute between cron ticks). flock is best effort: util-linux ships it on the VPS, and a
# host without it still gets the behaviour, just without the mutual exclusion.
if command -v flock >/dev/null 2>&1; then
  exec 9> "$STATE_DIR/guard.lock"
  flock -n 9 || exit 0
fi

docker_ready() {
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1 || return 1
}

# validate <path> -- succeeds only when Caddy itself can adapt that file. The env file is
# required because the site address is `{$API_DOMAIN}`, which resolves from .env.production;
# validating without it can fail a perfectly good Caddyfile.
validate() {
  docker run --rm --env-file "$ENV_FILE" --entrypoint caddy \
    -v "$1:/etc/caddy/Caddyfile:ro" \
    "$CADDY_IMAGE" validate --config /etc/caddy/Caddyfile --adapter caddyfile \
    > "$VALIDATE_LOG" 2>&1
}

is_crash_loop() {
  # Not `docker ps`: an auto-restarting container still lists as a row, which is exactly how
  # the incident stayed invisible for three minutes.
  local state
  state="$(docker inspect -f '{{.State.Status}} {{.State.Restarting}}' "$CONTAINER" 2>/dev/null)" || return 1
  case " $state " in
    *restarting* | *" true "*) return 0 ;;
    *) return 1 ;;
  esac
}

container_is_up() {
  [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ]
}

mounted_differs() {
  # Only the first two cksum fields are compared: the third is the path, which differs by design.
  local host mounted
  host="$(cksum "$CADDYFILE" 2>/dev/null | cut -d' ' -f1,2)" || return 1
  [ -n "$host" ] || return 1
  mounted="$(docker exec "$CONTAINER" cksum /etc/caddy/Caddyfile 2>/dev/null | cut -d' ' -f1,2)"
  # An unreadable container file is not evidence of drift: a container that is mid-restart cannot
  # be exec'd into, and guessing here would overwrite a config the guard has no proof is wrong.
  [ -n "$mounted" ] || return 1
  [ "$host" != "$mounted" ]
}

last_config_error() {
  # The wording Caddy 2.8 emits for a directive the image does not have:
  #   adapting config using caddyfile: ... unrecognized directive: rate_limit
  docker logs --since "$LOG_WINDOW" "$CONTAINER" 2>&1 |
    grep -E 'unrecognized directive|not valid Caddyfile|adapting config using caddyfile' |
    tail -n 1
}

promote() {
  local tmp="$GOOD.tmp"
  cp "$CADDYFILE" "$tmp" || return 1
  mv "$tmp" "$GOOD" || return 1
}

restore() {
  # cp, never a temp-file-plus-rename. This path is a single-file bind mount, and a bind mount
  # keeps following the inode it was made from: renaming a new file over $CADDYFILE would leave
  # the container reading the old, still-invalid inode while the host shows the fixed file.
  cp "$GOOD" "$CADDYFILE"
}

apply_config() {
  # A live container picks the restored file up without a restart, which costs no connections.
  if container_is_up && ! is_crash_loop &&
    docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile \
      > "$STATE_DIR/last-reload.log" 2>&1; then
    log "reloaded $CONTAINER in place"
    return 0
  fi
  # --no-deps so this cannot restart api, worker, qdrant or embeddings on the way.
  if docker compose -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE" > "$STATE_DIR/last-recreate.log" 2>&1; then
    log "recreated only the $SERVICE service"
    return 0
  fi
  log "compose could not recreate $SERVICE; see $STATE_DIR/last-recreate.log"
  return 1
}

main() {
  docker_ready || bail "docker is not answering; taking no action rather than guessing"
  [ -f "$CADDYFILE" ] || bail "$CADDYFILE is missing"
  [ -f "$ENV_FILE" ] || bail "$ENV_FILE is missing; {\$API_DOMAIN} in the Caddyfile cannot be resolved without it"
  [ -f "$COMPOSE_FILE" ] || bail "$COMPOSE_FILE is missing"

  local bad_on_disk=0 crashing=0 needs_restore=0 reason=""
  validate "$CADDYFILE" || bad_on_disk=1
  is_crash_loop && crashing=1

  if [ "$bad_on_disk" = "1" ]; then
    needs_restore=1
    reason="$CADDYFILE does not validate (see $VALIDATE_LOG)"
  elif [ "$crashing" = "1" ] && mounted_differs; then
    # The file on disk parses here but the bytes inside the mount are not those bytes: that is
    # what a rename-based edit leaves behind, because a bind mount keeps the original inode.
    needs_restore=1
    reason="$CONTAINER is crash-looping on bytes that are not $CADDYFILE; rewriting the mount in place"
  fi

  if [ "$needs_restore" = "0" ]; then
    if [ "$crashing" = "1" ]; then
      # Restoring would copy the identical bytes, and recreating every minute would restart a
      # proxy that is fine and bury the actual cause under guard churn.
      bail "$CONTAINER is crash-looping for a reason that is not the Caddyfile, leaving it alone. Newest proxy error: $(last_config_error)"
    fi
    if [ ! -f "$GOOD" ] || ! cmp -s "$GOOD" "$CADDYFILE"; then
      promote || bail "cannot write the backup at $GOOD"
      log "saved last-known-good Caddyfile"
    fi
    exit 0
  fi

  log "$reason"

  if [ ! -f "$GOOD" ]; then
    # No rollback and no invented config: the guard's only authority is a file that Caddy
    # already accepted once. Writing a guessed Caddyfile here could take down TLS for the box.
    bail "no last-known-good copy at $GOOD. Recover by hand (cd $REPO_DIR && git show HEAD:deploy/vps/Caddyfile > $CADDYFILE), which rewrites the file in place so the bind mount keeps its inode, and this guard takes over from there"
  fi

  if ! validate "$GOOD"; then
    bail "the backup at $GOOD no longer validates either; not making it worse"
  fi

  restore || bail "cannot write $CADDYFILE from the backup"

  if ! validate "$CADDYFILE"; then
    bail "restored the backup but $CADDYFILE still fails to validate"
  fi

  apply_config || exit 1
  log "$SERVICE is running the last-known-good Caddyfile again"
}

main "$@"
