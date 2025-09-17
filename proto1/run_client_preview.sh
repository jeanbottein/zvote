#!/usr/bin/env bash
set -euo pipefail

# Preview the built client (dist/) using Vite's preview server.
# Requires the client to be built already (run ./build_client.sh first).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="${CLIENT_DIR:-"$SCRIPT_DIR/client"}"
PORT="${PORT:-5173}"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed. Install from https://nodejs.org/" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed. Install from https://nodejs.org/" >&2
  exit 1
fi

# Expose on all interfaces for LAN testing
# You can override PORT via env. Example: PORT=8080 ./run_client_preview.sh
( cd "$CLIENT_DIR" && npm run preview -- --host --port "$PORT" )
