#!/bin/bash
set -e

echo "🎨 Building and running client with SpacetimeDB backend..."

cd "$(dirname "$0")/../clients/web" || exit 1

echo "📝 Using env vars for SpacetimeDB backend (same-origin /v1 via Vite proxy)..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Kill any existing npm processes on port 5173
PORT=${PORT:-5173}
echo "🧹 Cleaning up existing processes on port $PORT..."
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Killing process on port $PORT..."
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
fi

# Kill any stray npm processes
pkill -f "npm.*dev" 2>/dev/null || true
pkill -f "npm.*preview" 2>/dev/null || true

echo "🚀 Starting development server on http://localhost:$PORT"
echo "📡 Backend: SpacetimeDB at ws://localhost:${VITE_STDB_PORT:-3000} (proxied to /v1)"
VITE_BACKEND_TYPE=spacetime VITE_STDB_PORT=${VITE_STDB_PORT:-3000} npm run dev:spacetime
