#!/usr/bin/env bash
set -euo pipefail

# zvote local development.
#
#   ./dev.sh            start the server (:8080) and the web client (:5173)
#   ./dev.sh server     start only the Java server
#   ./dev.sh client     start only the web client
#   ./dev.sh test       run every check: server tests, client lint, types and tests
#
# Requires a JDK (21+) and Node (20.19+). Versions are pinned in .tool-versions:
# with mise or asdf installed, `mise install` provisions both. Maven is NOT
# required: the committed wrapper (servers/java/mvnw) is used instead.
#
# No database setup is needed. H2 runs inside the server process and stores its
# data in ZVOTE_DATA_DIR below, so the repo folder stays self-contained and can
# be copied between machines with its data intact.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT/servers/java"
CLIENT_DIR="$ROOT/clients/web"

# Absolute, repo-rooted data directory. Exported so the server never depends on
# the working directory it happens to be launched from.
export ZVOTE_DATA_DIR="${ZVOTE_DATA_DIR:-$ROOT/data}"

HEALTH_URL="http://localhost:8080/actuator/health"
MODE="${1:-all}"

SERVER_PID=""
CLIENT_PID=""

cleanup() {
  trap - EXIT INT TERM
  for pid in "$CLIENT_PID" "$SERVER_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: $1 not found. Install it, or run 'mise install' for the pinned versions." >&2
    exit 1
  }
}

require_node() {
  require node
  require npm
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)' || {
    echo "Error: Node $(node --version) is too old; the client needs 20.19 or newer (24 LTS recommended)." >&2
    exit 1
  }
  if [ ! -d "$CLIENT_DIR/node_modules" ]; then
    echo "Installing client dependencies..."
    (cd "$CLIENT_DIR" && npm install)
  fi
}

start_server() {
  require java
  mkdir -p "$ZVOTE_DATA_DIR"
  echo "Starting the server on :8080 (data in $ZVOTE_DATA_DIR)"
  (cd "$SERVER_DIR" && ./mvnw -q spring-boot:run) &
  SERVER_PID=$!
}

wait_for_server() {
  echo -n "Waiting for the server "
  for _ in $(seq 1 90); do
    if curl -fsS -o /dev/null "$HEALTH_URL" 2>/dev/null; then
      echo " ready."
      return 0
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo ""
      echo "Error: the server stopped before becoming ready. Its output is above." >&2
      exit 1
    fi
    printf '.'
    sleep 1
  done
  echo ""
  echo "Error: the server did not answer within 90 seconds." >&2
  exit 1
}

start_client() {
  require_node
  echo "Starting the web client on http://localhost:5173"
  (cd "$CLIENT_DIR" && npm run dev) &
  CLIENT_PID=$!
}

run_checks() {
  require java
  require_node
  echo "== Server: architecture, API and live-stream tests"
  (cd "$SERVER_DIR" && ./mvnw -q test)
  echo "== Client: lint, types, tests"
  (cd "$CLIENT_DIR" && npm run lint && npm run typecheck && npm test)
  echo "All checks passed."
}

case "$MODE" in
  server)
    start_server
    wait
    ;;
  client)
    start_client
    wait
    ;;
  all)
    start_server
    wait_for_server
    start_client
    wait
    ;;
  test)
    run_checks
    ;;
  *)
    echo "Usage: ./dev.sh [server|client|test]" >&2
    exit 2
    ;;
esac
