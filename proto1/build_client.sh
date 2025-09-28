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

cd "$CLIENT_DIR" || exit 1
# Install dependencies (idempotent)
npm install || exit 2

# Run tests (optional - don't fail build if tests fail)
echo "Running MJ algorithm tests..."
npm run test:mj || echo "⚠️  Tests failed, but continuing build..."

echo "Generating coverage report..."
npm run test:coverage || echo "⚠️  Coverage generation failed, but continuing build..."

# Build
npm run build || exit 5

echo "Client build finished. Output: $CLIENT_DIR/dist/"
