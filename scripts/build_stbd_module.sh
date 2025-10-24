#!/usr/bin/env bash
set -euo pipefail

# Build the SpacetimeDB module under proto1/server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="${MODULE_DIR:-"$SCRIPT_DIR/../servers/spacetimedb"}"

export PATH="$HOME/.cargo/bin:$PATH"

if ! command -v spacetime >/dev/null 2>&1; then
  echo "Error: spacetime CLI not found. Install from https://spacetimedb.com/install" >&2
  exit 1
fi

echo "[build] Ensuring wasm32 target..."
if command -v rustup >/dev/null 2>&1; then
  if ! rustup target list --installed | grep -q '^wasm32-unknown-unknown$'; then
    echo "[build] Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown 1>/dev/null
  fi
fi

# Run tests
echo "[build] Running tests..."
"$SCRIPT_DIR/test_stdb_module.sh" 1>/dev/null || exit 2

cd "$MODULE_DIR" || exit 1

# Build the WASM module and regenerate the client SDK
echo "[build] Building SpacetimeDB module..."
spacetime build 1>/dev/null || exit 3

echo "[build] Regenerating client SDK..."
rm -rf ../../clients/web/src/generated || exit 4
spacetime generate --lang typescript --out-dir ../../clients/web/src/generated 1>/dev/null || exit 5

echo "Build finished."
