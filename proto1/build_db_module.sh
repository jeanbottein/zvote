#!/usr/bin/env bash
set -euo pipefail

# Build the SpacetimeDB module under proto1/server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="${MODULE_DIR:-"$SCRIPT_DIR/server"}"

export PATH="$HOME/.cargo/bin:$PATH"

if ! command -v spacetime >/dev/null 2>&1; then
  echo "Error: spacetime CLI not found. Install from https://spacetimedb.com/install" >&2
  exit 1
fi

# Ensure wasm32 target (safe if already installed)
if command -v rustup >/dev/null 2>&1; then
  if ! rustup target list --installed | grep -q '^wasm32-unknown-unknown$'; then
    echo "Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
  fi
fi

( cd "$MODULE_DIR" && spacetime build && rm -rf ../client/src/generated && spacetime generate --lang typescript --out-dir ../client/src/generated)

echo "Build finished."
