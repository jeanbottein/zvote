#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_cli

log "Using module: $MODULE"
[ -n "${SERVER_ALIAS:-}" ] && log "Using server alias: $SERVER_ALIAS"

# Ensure singleton server info exists
ensure_server_info || true

# Create a couple of votes
create_vote "Lunch poll" true  "Pizza" "Sushi" "Salad"
create_vote "Private Q4 roadmap" false "Ship" "Delay" "Re-scope"

log "Votes table:"
sql "SELECT id, title, public, created_at FROM vote ORDER BY id" || true

log "Options per vote:"
sql "SELECT vote_id, COUNT(*) AS options FROM vote_option GROUP BY vote_id ORDER BY vote_id" || true

log "Done: test-create-votes.sh"
