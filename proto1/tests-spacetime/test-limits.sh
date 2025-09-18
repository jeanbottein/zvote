#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_cli

log "Using module: $MODULE"
[ -n "${SERVER_ALIAS:-}" ] && log "Using server alias: $SERVER_ALIAS"

ensure_server_info || true

# Get server-side limit
LIMIT="$(sql_first_int "SELECT max_options FROM server_info WHERE id=1")"
if [ -z "$LIMIT" ]; then
  echo "Could not determine server max_options from server_info. Did you publish the latest module?" >&2
  exit 1
fi
log "Server MAX_OPTIONS = $LIMIT"

# Remember last vote id
BEFORE_MAX_ID="$(sql_first_int "SELECT COALESCE(MAX(id),0) FROM vote")"

# Build  (LIMIT + 5) options to test truncation
OPTS=()
COUNT=$((LIMIT + 5))
for ((i=1;i<=COUNT;i++)); do OPTS+=("Opt $i"); done

create_vote "Limit Truncation Test" true "${OPTS[@]}"

# Find the newly created vote id
AFTER_MAX_ID="$(sql_first_int "SELECT COALESCE(MAX(id),0) FROM vote")"
if [ "$AFTER_MAX_ID" = "$BEFORE_MAX_ID" ]; then
  echo "Failed to detect new vote id. Aborting." >&2
  exit 1
fi
VOTE_ID="$AFTER_MAX_ID"

# Count options for the new vote
OPT_COUNT="$(sql_first_int "SELECT COUNT(*) FROM vote_option WHERE vote_id=$VOTE_ID")"
log "New vote_id=$VOTE_ID has $OPT_COUNT options (expected: $LIMIT)"

if [ "$OPT_COUNT" = "$LIMIT" ]; then
  log "PASS: Over-limit options were truncated to $LIMIT"
else
  echo "FAIL: Expected $LIMIT options, got $OPT_COUNT" >&2
  exit 1
fi

log "Done: test-limits.sh"
