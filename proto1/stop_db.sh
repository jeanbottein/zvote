#!/usr/bin/env bash
set -euo pipefail

# Stop local SpacetimeDB server if it was started by start.sh (PID file based).
# If the server was started in another terminal without the PID file,
# we will not attempt to kill it and will display guidance.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.spacetime.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${PID}" ]] && kill -0 "$PID" >/dev/null 2>&1; then
    echo "Stopping SpacetimeDB server (PID $PID)..."
    kill "$PID" || true
    # Wait briefly for graceful shutdown
    for i in {1..40}; do
      if kill -0 "$PID" >/dev/null 2>&1; then
        sleep 0.25
      else
        break
      fi
    done
    if kill -0 "$PID" >/dev/null 2>&1; then
      echo "Force killing PID $PID..."
      kill -9 "$PID" || true
    fi
    echo "Stopped."
  else
    echo "No running server process found for PID $PID. Cleaning up PID file."
  fi
  rm -f "$PID_FILE"
else
  echo "No PID file found at $PID_FILE."
  echo "If you started SpacetimeDB in another terminal (via 'spacetime start'), stop it there (Ctrl-C)."
fi
