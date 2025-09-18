#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_cli

log "Using module: $MODULE"
[ -n "${SERVER_ALIAS:-}" ] && log "Using server alias: $SERVER_ALIAS"

ensure_server_info || true

# Start from a clean slate to make counts predictable
reset_db || true

# Create mixed visibility votes
create_vote "Team Lunch" true  "Pizza" "Sushi"
create_vote "Planning"   false "Ship"  "Delay"
create_vote "Retro"      true  "Keep"  "Start" "Stop"

log "Votes by visibility:"
sql "SELECT public, COUNT(*) AS cnt FROM vote GROUP BY public ORDER BY public" || true

log "All votes:"
sql "SELECT id, title, public FROM vote ORDER BY id" || true

log "Done: test-public-filters.sh"
