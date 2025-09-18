#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_cli

log "Using module: $MODULE"
[ -n "${SERVER_ALIAS:-}" ] && log "Using server alias: $SERVER_ALIAS"

# Ensure server info exists
ensure_server_info || true

# Create a small vote
create_vote "Approval Flow" true "A" "B" "C"

# Find the last vote id
VOTE_ID="$(sql_first_int "SELECT MAX(id) FROM vote")"

# Fetch option ids for that vote
log "Options for vote_id=$VOTE_ID:"
sql "SELECT id, label, approvals_count FROM vote_option WHERE vote_id=$VOTE_ID ORDER BY id"

# Approve option 1 and 2
OID1="$(sql_first_int "SELECT id FROM vote_option WHERE vote_id=$VOTE_ID ORDER BY id LIMIT 1")"
OID2="$(sql_first_int "SELECT id FROM vote_option WHERE vote_id=$VOTE_ID ORDER BY id OFFSET 1 LIMIT 1")"

log "Approving OID1=$OID1 and OID2=$OID2"
approve "$VOTE_ID" "$OID1"
approve "$VOTE_ID" "$OID2"

log "After approvals:"
sql "SELECT id, approvals_count FROM vote_option WHERE vote_id=$VOTE_ID ORDER BY id"

log "Unapproving OID1=$OID1"
unapprove "$VOTE_ID" "$OID1"

log "After unapprove:"
sql "SELECT id, approvals_count FROM vote_option WHERE vote_id=$VOTE_ID ORDER BY id"

log "Done: test-approvals.sh"
