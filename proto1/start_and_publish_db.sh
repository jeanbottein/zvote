#!/usr/bin/env bash
set -euo pipefail

# Start local SpacetimeDB server if not running, then publish this module.
# Configurable via environment:
#   MODULE_DIR   - path to module (default: proto1/server relative to this script)
#   MODULE_NAME  - published database name (default: zvote-proto1)
#   ZVOTE_MODULE_NAME - alternate env var to set module name

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="${MODULE_DIR:-"$SCRIPT_DIR/server"}"
MODULE_NAME="${MODULE_NAME:-${ZVOTE_MODULE_NAME:-zvote-proto1}}"
LOG_FILE="$SCRIPT_DIR/.spacetime.log"
PID_FILE="$SCRIPT_DIR/.spacetime.pid"
SPACETIME_SERVER="${SPACETIME_SERVER:-local}"

# Ensure cargo-installed tools are available when run from GUI/cron
export PATH="$HOME/.cargo/bin:$PATH"

have_spacetime() { command -v spacetime >/dev/null 2>&1; }

if ! have_spacetime; then
  echo "Error: spacetime CLI not found in PATH. Install: https://spacetimedb.com/install" >&2
  exit 1
fi

echo "Checking SpacetimeDB server status..."
if spacetime server ping "$SPACETIME_SERVER" >/dev/null 2>&1; then
  echo "SpacetimeDB server is already running."
else
  echo "Starting SpacetimeDB server in background..."
  nohup spacetime start >"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"

  # Wait for server to come online
  echo -n "Waiting for server to come online"
  for i in {1..60}; do
    if spacetime server ping "$SPACETIME_SERVER" >/dev/null 2>&1; then
      echo "\nSpacetimeDB server is up."
      break
    fi
    echo -n "."
    sleep 0.5
  done
  if ! spacetime server ping "$SPACETIME_SERVER" >/dev/null 2>&1; then
    echo "\nError: SpacetimeDB server failed to start in time. See $LOG_FILE" >&2
    exit 1
  fi
fi

# Optionally ensure wasm32 target (harmless if already installed)
if command -v rustup >/dev/null 2>&1; then
  if ! rustup target list --installed | grep -q '^wasm32-unknown-unknown$'; then
    echo "Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
  fi
fi

# Publish/upgrade module under chosen name
echo "Publishing module '$MODULE_NAME' from $MODULE_DIR ..."
spacetime publish --project-path "$MODULE_DIR" "$MODULE_NAME"

cat <<EOF
Done.
- Logs:      spacetime logs $MODULE_NAME
- SQL:       spacetime sql $MODULE_NAME "SELECT * FROM vote"
- Call API: spacetime call $MODULE_NAME create_vote '"Title"' '["A","B"]' true
EOF
