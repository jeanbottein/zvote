#!/bin/bash
set -e

echo "🚀 Starting ZVote with SpacetimeDB backend..."
echo ""

cd "$(dirname "$0")/scripts" || exit 1

echo "1️⃣  Building SpacetimeDB module..."
./build_stbd_module.sh || exit 2

echo ""
echo "2️⃣  Starting SpacetimeDB and publishing module..."
./start_stdb_and_publish_module.sh &
STDB_PID=$!

# Wait for SpacetimeDB to be ready
echo "⏳ Waiting for SpacetimeDB to be ready..."
MAX_WAIT=30
WAITED=0
until curl -s http://127.0.0.1:3000/v1/database > /dev/null 2>&1; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "❌ SpacetimeDB failed to start after ${MAX_WAIT}s"
    kill $STDB_PID 2>/dev/null || true
    exit 1
  fi
  echo -n "."
done
echo ""
echo "✅ SpacetimeDB ready!"
echo ""

echo "3️⃣  Starting client with SpacetimeDB backend..."
./build_and_run_client_spacetime.sh || exit 3

# Cleanup on exit
trap "kill $STDB_PID 2>/dev/null || true" EXIT