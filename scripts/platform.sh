#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_DIR="$ROOT_DIR/teamcc-admin"
TEAMSKILL_DIR="$ROOT_DIR/TeamSkill-ClaudeCode"
SKILL_GRAPH_DIR="$ROOT_DIR/skill-graph"
ADMIN_COMPOSE_FILE="$ADMIN_DIR/docker-compose.yml"
SKILL_COMPOSE_FILE="$SKILL_GRAPH_DIR/docker-compose.skill-data.yml"
SKILL_COMPOSE_PROJECT="${SKILL_COMPOSE_PROJECT:-teamskill-claudecode}"
ADMIN_CORE_SERVICES=(postgres api web)
SKILL_CORE_SERVICES=(skill-pg skill-redis skill-neo4j)
SKILL_LANGFUSE_SERVICES=(
  langfuse-postgres
  langfuse-redis
  langfuse-clickhouse
  langfuse-minio
  langfuse-worker
  langfuse-web
)

compose_admin() {
  docker compose -f "$ADMIN_COMPOSE_FILE" "$@"
}

compose_skill() {
  docker compose -p "$SKILL_COMPOSE_PROJECT" -f "$SKILL_COMPOSE_FILE" "$@"
}

usage() {
  cat <<'EOF'
Usage: ./scripts/platform.sh <command>

Commands:
  start        Build and start the core platform containers
  start-full   Start core containers plus optional Langfuse services
  stop         Stop and remove the default core containers
  stop-full    Stop and remove core containers plus Langfuse services
  restart      Restart the default core containers
  restart-full Restart the full container set
  status       Show platform container status
  logs         Tail admin container logs

Core services:
  - teamcc-admin: postgres, api, web
  - skill-graph : skill-pg, skill-redis, skill-neo4j

Optional services:
  - skill-graph : langfuse-postgres, langfuse-redis, langfuse-clickhouse,
                  langfuse-minio, langfuse-worker, langfuse-web
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
  local mode="${1:-core}"
  cat <<'EOF'
Platform services started.

Core services:
  Admin:
  Web: http://127.0.0.1:5173
  API: http://127.0.0.1:3000
  DB : localhost:5432

  TeamSkill data:
  PG    : localhost:54329
  Redis : localhost:6381
  Neo4j : http://127.0.0.1:7474
EOF

  if [[ "$mode" == "full" ]]; then
    cat <<'EOF'

Optional services:
  Langfuse Web      : http://127.0.0.1:3300
  Langfuse Worker   : http://127.0.0.1:3031
  Langfuse Postgres : localhost:54330
  Langfuse Redis    : localhost:6380
  MinIO API         : http://127.0.0.1:9090
  MinIO Console     : http://127.0.0.1:9091
EOF
  fi
}

check_core_ports() {
  stop_legacy_admin_processes
  check_port_conflict 3000
  check_port_conflict 5173
  check_port_conflict 5432
  check_port_conflict 54329
  check_port_conflict 6381
  check_port_conflict 7474
  check_port_conflict 7687
}

check_optional_ports() {
  check_port_conflict 3031
  check_port_conflict 3300
  check_port_conflict 54330
  check_port_conflict 6380
  check_port_conflict 8124
  check_port_conflict 9002
  check_port_conflict 9090
  check_port_conflict 9091
}

start_platform() {
  check_core_ports

  compose_admin up -d --build "${ADMIN_CORE_SERVICES[@]}"
  compose_skill up -d "${SKILL_CORE_SERVICES[@]}"
  print_access_info core
}

start_platform_full() {
  check_core_ports
  check_optional_ports

  compose_admin up -d --build "${ADMIN_CORE_SERVICES[@]}"
  compose_skill up -d "${SKILL_CORE_SERVICES[@]}" "${SKILL_LANGFUSE_SERVICES[@]}"
  print_access_info full
}

stop_platform() {
  stop_legacy_admin_processes
  compose_admin down
  compose_skill rm -fsv "${SKILL_CORE_SERVICES[@]}" >/dev/null 2>&1 || true
}

stop_platform_full() {
  stop_legacy_admin_processes
  compose_admin down
  compose_skill down
}

status_platform() {
  echo "== Core: teamcc-admin =="
  compose_admin ps "${ADMIN_CORE_SERVICES[@]}"
  echo
  echo "== Core: skill-graph =="
  compose_skill ps "${SKILL_CORE_SERVICES[@]}"
  echo
  echo "== Optional: Langfuse =="
  compose_skill ps "${SKILL_LANGFUSE_SERVICES[@]}"
}

logs_platform() {
  compose_admin logs -f --tail=100
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
    start-full)
      start_platform_full
      ;;
    stop)
      stop_platform
      ;;
    stop-full)
      stop_platform_full
      ;;
    restart)
      stop_platform
      start_platform
      ;;
    restart-full)
      stop_platform_full
      start_platform_full
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
