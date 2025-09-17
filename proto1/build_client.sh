#!/usr/bin/env bash
set -euo pipefail

# Build the Vite TypeScript client in proto1/client

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="${CLIENT_DIR:-"$SCRIPT_DIR/client"}"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed. Install from https://nodejs.org/" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed. Install from https://nodejs.org/" >&2
  exit 1
fi

# Install dependencies (idempotent)
( cd "$CLIENT_DIR" && npm install )

# Build
( cd "$CLIENT_DIR" && npm run build )

echo "Client build finished. Output: $CLIENT_DIR/dist/"
