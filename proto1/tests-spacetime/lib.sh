#!/usr/bin/env bash
set -euo pipefail

# Shared helpers for SpacetimeDB tests
# Usage: source this file from test-*.sh scripts.

# Configuration
MODULE="${MODULE:-${ZVOTE_MODULE_NAME:-zvote-proto1}}"
SERVER_ALIAS="${SERVER_ALIAS:-${SPACETIME_SERVER:-}}"  # optional; requires your CLI to support default or alias

log() { printf "\n[tests] %s\n" "$*"; }

require_cli() {
  if ! command -v spacetime >/dev/null 2>&1; then
    echo "Error: 'spacetime' CLI not found in PATH. Install: https://spacetimedb.com/install" >&2
    exit 1
  fi
}

# Run a spacetime command. If you maintain server aliases, consider adding --server "$SERVER_ALIAS" here.
st() {
  if [ -n "${SERVER_ALIAS:-}" ]; then
    spacetime --server "$SERVER_ALIAS" "$@"
  else
    spacetime "$@"
  fi
}

# Quote a string for JSON
json_escape() {
  local s="${1//\\/\\\\}"
  s="${s//\"/\\\"}"
  printf '%s' "$s"
}
json_quote() { printf '"%s"' "$(json_escape "$1")"; }

# Build a JSON array of strings from args
json_array() {
  local first=1
  printf '['
  for arg in "$@"; do
    if [ $first -eq 0 ]; then printf ','; fi
    first=0
    json_quote "$arg"
  done
  printf ']'
}

# Convenience wrappers -------------------------------------------------------

# Call module reducer
call() {
  # Usage: call reducer_name arg1 arg2 ... (already JSON-quoted where needed)
  st call "$MODULE" "$@"
}

# Execute SQL query against the module
sql() {
  # Usage: sql "SELECT * FROM vote"  (do not include module)
  st sql "$MODULE" "$1"
}

# Extract the first integer result from a SQL query output
sql_first_int() {
  # This is a best-effort parser for the CLI's table output.
  # It greps digits and returns the first number it encounters.
  st sql "$MODULE" "$1" | grep -Eo '[0-9]+' | head -n 1
}

# Seed singleton server_info (safe to call multiple times)
ensure_server_info() {
  # reducer name: ensure_server_info (snake_case)
  call ensure_server_info || true
}

# Create a vote with options
create_vote() {
  # Args: title public_flag [options...]
  local title="$1"; shift
  local public_flag="$1"; shift
  local title_json; title_json=$(json_quote "$title")
  local opts_json; opts_json=$(json_array "$@")
  log "create_vote title=$title public=$public_flag options=$*"
  call create_vote "$title_json" "$opts_json" "$public_flag"
}

# Approve / Unapprove wrappers
approve() { # vote_id option_id
  call approve "$1" "$2"
}
unapprove() { # vote_id option_id
  call unapprove "$1" "$2"
}

# Danger: clear all data (use for tests only)
reset_db() {
  log "Resetting database contents (approvals, vote_option, vote)..."
  sql "DELETE FROM approval" || true
  sql "DELETE FROM vote_option" || true
  sql "DELETE FROM vote" || true
}
