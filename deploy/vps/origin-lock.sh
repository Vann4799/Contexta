#!/usr/bin/env bash
# Keep the Contexta origin reachable only through Cloudflare.
#
# Why DOCKER-USER: Docker installs its own published-port rules in the FORWARD chain and rewrites
# them whenever a container is (re)created, so rules added there get destroyed by `compose up`.
# DOCKER-USER is the chain Docker deliberately leaves untouched and evaluates first.
#
# Why this must also run at boot: DOCKER-USER is emptied by a Docker daemon restart or a host
# reboot (not by `docker compose up`), so the lock is only as durable as whatever re-applies it.
# Install deploy/vps/contexta-origin-lock.service for that.
#
# Rollback, if a legitimate source ever has to reach the origin directly:
#   bash /tmp/unlock_origin.sh   # or: see remove_lock() below
set -uo pipefail

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

CF_IPS_URL=https://api.cloudflare.com/client/v4/ips
PORTS=80,443

if ! curl -fsS --max-time 15 "$CF_IPS_URL" -o /tmp/cloudflare-ips.json; then
  echo "REFUSE: could not fetch $CF_IPS_URL; leaving the existing rules untouched" >&2
  exit 1
fi
mapfile -t CIDRS < <(python3 -c '
import json
print("\n".join(json.load(open("/tmp/cloudflare-ips.json"))["result"]["ipv4_cidrs"]))')
if [ "${#CIDRS[@]}" -lt 10 ]; then
  echo "REFUSE: only ${#CIDRS[@]} Cloudflare ranges returned; that is not a trustworthy list" >&2
  exit 1
fi

$SUDO iptables -N CONTEXTA-ORIGIN 2>/dev/null || true
$SUDO iptables -F CONTEXTA-ORIGIN
for p in "${CIDRS[@]}"; do
  $SUDO iptables -A CONTEXTA-ORIGIN -s "$p" -j ACCEPT
done
# On-box probes (health checks, the Caddy guard) reach the published ports from loopback or the
# docker bridge. Neither is reachable from the internet, so allowing them costs nothing.
$SUDO iptables -A CONTEXTA-ORIGIN -s 127.0.0.0/8 -j ACCEPT
$SUDO iptables -A CONTEXTA-ORIGIN -s 172.16.0.0/12 -j ACCEPT

# Idempotent: remove then insert, so re-running never stacks duplicates.
$SUDO iptables -D DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
$SUDO iptables -I DOCKER-USER 1 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
$SUDO iptables -D DOCKER-USER -p tcp -m multiport --dports "$PORTS" -j CONTEXTA-ORIGIN 2>/dev/null || true
$SUDO iptables -I DOCKER-USER 2 -p tcp -m multiport --dports "$PORTS" -j CONTEXTA-ORIGIN
$SUDO iptables -C DOCKER-USER -p tcp -m multiport --dports "$PORTS" -j DROP 2>/dev/null \
  || $SUDO iptables -A DOCKER-USER -p tcp -m multiport --dports "$PORTS" -j DROP

# Port 22 is deliberately absent: SSH is the way back in if this rule is ever wrong.
echo "origin locked to ${#CIDRS[@]} Cloudflare ranges on $PORTS"
$SUDO iptables -L DOCKER-USER -n --line-numbers
