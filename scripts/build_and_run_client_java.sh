#!/bin/bash
set -e

echo "🎨 Building and running client with Java GraphQL backend..."

cd "$(dirname "$0")/../clients/web" || exit 1

echo "📝 Using env vars for Java GraphQL backend (same-origin /graphql via Vite proxy)..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Clear Vite cache to ensure environment variables are picked up
echo "🧹 Clearing Vite cache..."
rm -rf .vite 2>/dev/null || true
rm -rf node_modules/.vite 2>/dev/null || true

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
echo "📡 Backend: Java GraphQL at http://localhost:${VITE_BACKEND_PORT:-8080} (proxied to /graphql)"
echo "📡 Backend Type: graphql"
VITE_BACKEND_TYPE=graphql VITE_BACKEND_PORT=${VITE_BACKEND_PORT:-8080} npm run dev:graphql
