#!/usr/bin/env bash
# Chaos toolbox for the Neon Noodle Bar demo.
# Watch the city react on http://localhost:3001 while you break things.
set -euo pipefail

cd "$(dirname "$0")"

BACKEND_1=http://localhost:8081
BACKEND_2=http://localhost:8082

usage() {
  cat <<'EOF'
Usage: ./chaos.sh <command> [args]

  kill <service>       Kill a container (backend-1, backend-2, frontend-1,
                       frontend-2, postgres, loadgen, ...) -> building goes
                       critical, ReplicaDown/PostgresDown fires.
  restore              Restart everything + reset chaos on both backends.
  errors [seconds]     Both backends answer ~70% HTTP 500 on /api
                       -> towers drop to warning/critical, HighErrorRate fires.
  slow [seconds]       Inject ~900ms latency on /api -> HighLatency fires.
  cpu [seconds]        Burn CPU on backend-1 (default 180s)
                       -> tower gauge climbs, HighCPU fires.
  db-flood [n]         Open n idle Postgres connections (default 80)
                       -> the silo fills up, PgConnectionsHigh fires.
  status               docker compose ps + chaos state of both backends.
EOF
  exit 1
}

post() { # post <url> [description]
  curl -fsS -X POST "$1" && echo
}

cmd=${1:-}
case "$cmd" in
  kill)
    svc=${2:?usage: ./chaos.sh kill <service>}
    docker compose kill "$svc"
    echo "☠  $svc killed — watch its building go dark (ReplicaDown fires in ~1-2min)."
    ;;
  restore)
    docker compose up -d
    sleep 2
    post "$BACKEND_1/chaos/reset" || true
    post "$BACKEND_2/chaos/reset" || true
    echo "✅ Everything restarted, chaos reset — the city returns to cyan."
    ;;
  errors)
    s=${2:-120}
    post "$BACKEND_1/chaos/errors?seconds=$s&rate=0.7"
    post "$BACKEND_2/chaos/errors?seconds=$s&rate=0.7"
    echo "🔥 ~70% of /api requests now fail for ${s}s — HighErrorRate fires in ~2-3min."
    ;;
  slow)
    s=${2:-180}
    post "$BACKEND_1/chaos/slow?seconds=$s&ms=900"
    post "$BACKEND_2/chaos/slow?seconds=$s&ms=900"
    echo "🐌 /api now takes ~900ms for ${s}s — HighLatency fires in ~2-3min."
    ;;
  cpu)
    s=${2:-180}
    post "$BACKEND_1/chaos/cpu?seconds=$s"
    echo "🌋 backend-1 burns CPU for ${s}s — watch the tower gauge, HighCPU fires in ~1-2min."
    ;;
  db-flood)
    n=${2:-80}
    post "$BACKEND_1/chaos/db-flood?connections=$n&seconds=120"
    echo "🌊 $n idle Postgres connections held for 120s — the silo fills, PgConnectionsHigh fires."
    ;;
  status)
    docker compose ps
    echo
    echo "backend-1: $(curl -fsS "$BACKEND_1/chaos/status" 2>/dev/null || echo unreachable)"
    echo "backend-2: $(curl -fsS "$BACKEND_2/chaos/status" 2>/dev/null || echo unreachable)"
    ;;
  *)
    usage
    ;;
esac
