#!/usr/bin/env bash
set -euo pipefail

# Build the Vite TypeScript client in proto1/client
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="${CLIENT_DIR:-"$SCRIPT_DIR/../client"}"
PORT="${PORT:-5173}"

cd "$CLIENT_DIR" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed. Install from https://nodejs.org/" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed. Install from https://nodejs.org/" >&2
  exit 2
fi

# Install dependencies (idempotent)
npm install || exit 3

# Build
npm run build || exit 4

# Run tests (optional - don't fail build if tests fail)
echo "Running tests..."
npm run test || exit 5

echo "Generating coverage report..."
npm run test:coverage || echo "⚠️  Coverage generation failed, but continuing build..."

npm run preview -- --host --port "$PORT"
