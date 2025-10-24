#!/bin/bash
set -e

echo "🚀 Starting ZVote with Java GraphQL backend..."
echo ""

cd "$(dirname "$0")" || exit 1

# Store PIDs for cleanup
JAVA_PID=""
CLIENT_PID=""

# Function to handle cleanup
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    
    # Kill client if running
    if [ -n "$CLIENT_PID" ] && kill -0 "$CLIENT_PID" 2>/dev/null; then
        echo "Stopping client (PID: $CLIENT_PID)..."
        kill "$CLIENT_PID" 2>/dev/null || true
        sleep 1
    fi
    
    # Kill Java server if running
    if [ -n "$JAVA_PID" ] && kill -0 "$JAVA_PID" 2>/dev/null; then
        echo "Stopping Java server (PID: $JAVA_PID)..."
        kill "$JAVA_PID" 2>/dev/null || true
        sleep 1
    fi
    
    # Force kill any remaining processes
    echo "Cleaning up remaining processes..."
    pkill -9 -f "mvn.*spring-boot:run" 2>/dev/null || true
    pkill -9 -f "java.*spring-boot" 2>/dev/null || true
    pkill -9 -f "npm.*dev" 2>/dev/null || true
    
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Java server in background
echo "1️⃣  Starting Java Spring Boot server..."
cd scripts || exit 1
./start_java_server.sh &
JAVA_PID=$!
cd ..

# Wait for Java server to be ready
echo "⏳ Waiting for Java server to start..."
MAX_WAIT=60
WAITED=0
until curl -s http://localhost:8080/graphql > /dev/null 2>&1; do
    sleep 1
    WAITED=$((WAITED + 1))
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "❌ Java server failed to start after ${MAX_WAIT}s"
        kill $JAVA_PID 2>/dev/null || true
        exit 1
    fi
    echo -n "."
done
echo ""
echo "✅ Java server ready!"
echo ""

# Start client
echo "2️⃣  Starting client with Java GraphQL backend..."
cd scripts || exit 1
./build_and_run_client_java.sh &
CLIENT_PID=$!
cd ..

# Wait for background jobs
wait
