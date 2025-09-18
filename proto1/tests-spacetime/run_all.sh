#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# You can set MODULE and SERVER_ALIAS env vars before running.
# Example:
#   MODULE=zvote-proto1 SERVER_ALIAS=mylocal ./run_all.sh

echo "[tests] Running all test scripts..."

bash test-public-filters.sh
bash test-create-votes.sh
bash test-approvals.sh
bash test-limits.sh

echo "\n[tests] All tests completed."
