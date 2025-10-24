#!/bin/bash
set -e

echo "🚀 Starting Java Spring Boot server..."

cd "$(dirname "$0")/../servers/java" || exit 1

# Check if Maven is installed
if ! command -v mvn &> /dev/null; then
    echo "❌ Maven not found. Please install Maven first."
    exit 1
fi

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "❌ Java not found. Please install Java 21 or higher."
    exit 1
fi

# Clean and rebuild to ensure fresh config is used
echo "Cleaning previous build..."
mvn clean > /dev/null 2>&1 || true

# Start the server (will stay running)
echo "Starting server on http://localhost:8080"
mvn spring-boot:run
