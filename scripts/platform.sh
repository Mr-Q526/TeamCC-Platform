#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_DIR="$ROOT_DIR/teamcc-admin"
TEAMSKILL_DIR="$ROOT_DIR/TeamSkill-ClaudeCode"
SKILL_GRAPH_DIR="$ROOT_DIR/skill-graph"
ADMIN_COMPOSE_FILE="$ADMIN_DIR/docker-compose.yml"
SKILL_COMPOSE_FILE="$SKILL_GRAPH_DIR/docker-compose.skill-data.yml"

usage() {
  cat <<'EOF'
Usage: ./scripts/platform.sh <command>

Commands:
  start   Build and start the platform containers
  stop    Stop the platform containers
  restart Restart the platform containers
  status  Show platform container status
  logs    Tail admin container logs

Long-running services started by this script:
  - teamcc-admin-db
  - teamcc-admin-api
  - teamcc-admin-web
  - teamskill-skill-pg
  - teamskill-skill-neo4j
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

quit_screen_if_exists() {
  local name="$1"
  if screen -ls | rg -q "\\.${name}[[:space:]]"; then
    screen -S "$name" -X quit || true
  fi
}

stop_legacy_admin_processes() {
  quit_screen_if_exists "teamcc-admin-api"
  quit_screen_if_exists "teamcc-admin-web"
  quit_screen_if_exists "teamcc-admin-dev"
  quit_screen_if_exists "teamcc-admin-frontend"
  pkill -f 'teamcc-admin/node_modules/.bin/tsx src/main.ts' || true
  pkill -f 'teamcc-admin/node_modules/tsx/dist/loader.mjs src/main.ts' || true
  pkill -f 'teamcc-admin/frontend/node_modules/.bin/vite' || true
  sleep 1
}

check_port_conflict() {
  local port="$1"
  local output
  output="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -n "$output" ]] && ! grep -Eq 'com\.dock|docker-proxy|vpnkit' <<<"$output"; then
    echo "Port $port is already in use:" >&2
    echo "$output" >&2
    exit 1
  fi
}

print_access_info() {
  cat <<'EOF'
Platform services started.

Admin:
  Web: http://127.0.0.1:5173
  API: http://127.0.0.1:3000
  DB : localhost:5432

TeamSkill data:
  PG    : localhost:54329
  Neo4j : http://127.0.0.1:7474
EOF
}

start_platform() {
  stop_legacy_admin_processes
  check_port_conflict 3000
  check_port_conflict 5173
  check_port_conflict 5432
  check_port_conflict 54329
  check_port_conflict 7474
  check_port_conflict 7687

  docker compose -f "$ADMIN_COMPOSE_FILE" up -d --build
  docker compose -f "$SKILL_COMPOSE_FILE" up -d
  print_access_info
}

stop_platform() {
  docker compose -f "$ADMIN_COMPOSE_FILE" down
  docker compose -f "$SKILL_COMPOSE_FILE" down
}

status_platform() {
  echo "== teamcc-admin =="
  docker compose -f "$ADMIN_COMPOSE_FILE" ps
  echo
  echo "== TeamSkill data =="
  docker compose -f "$SKILL_COMPOSE_FILE" ps
}

logs_platform() {
  docker compose -f "$ADMIN_COMPOSE_FILE" logs -f --tail=100
}

main() {
  require_cmd docker
  require_cmd screen
  require_cmd rg
  require_cmd lsof

  case "${1:-}" in
    start)
      start_platform
      ;;
    stop)
      stop_platform
      ;;
    restart)
      stop_platform
      start_platform
      ;;
    status)
      status_platform
      ;;
    logs)
      logs_platform
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "${1:-}"
