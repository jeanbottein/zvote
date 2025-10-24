#!/usr/bin/env bash
set -euo pipefail

# Run Rust unit tests for the SpacetimeDB server module WITHOUT affecting normal builds.
# This script temporarily switches the crate-type to "rlib" and targets the host triple
# so tests link natively. It restores the original Cargo.toml afterwards.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="${MODULE_DIR:-"$SCRIPT_DIR/../servers/spacetimedb"}"
CARGO_TOML="$MODULE_DIR/Cargo.toml"
BACKUP_TOML="$MODULE_DIR/Cargo.toml.bak.tests"

if [ ! -f "$CARGO_TOML" ]; then
  echo "Error: $CARGO_TOML not found" >&2
  exit 1
fi

# Detect host triple for native tests
if ! command -v rustc >/dev/null 2>&1; then
  echo "Error: rustc not found in PATH" >&2
  exit 2
fi
HOST_TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
if [ -z "$HOST_TRIPLE" ]; then
  echo "Error: unable to detect Rust host triple" >&2
  exit 2
fi

echo "[tests] Using host target: $HOST_TRIPLE"

# Backup Cargo.toml and switch crate-type to rlib for host linking
cp "$CARGO_TOML" "$BACKUP_TOML"
restore() {
  mv "$BACKUP_TOML" "$CARGO_TOML" || true
}
trap restore EXIT

# Switch crate-type to rlib within [lib] section
# Works on macOS (BSD sed) and GNU sed by using the -i '' form
sed -i '' -E 's/^crate-type = \[[^\]]*\]/crate-type = ["rlib"]/g' "$CARGO_TOML" || {
  echo "Error: failed to set crate-type to rlib" >&2
  exit 3
}

# Run tests in server module against the host target
(
  cd "$MODULE_DIR"
  cargo test --target "$HOST_TRIPLE" "$@" 1>/dev/null
)

echo "[tests] Completed successfully"
