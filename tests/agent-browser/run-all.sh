#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8080}"

./tests/agent-browser/desktop-smoke.sh "$BASE_URL"
./tests/agent-browser/mobile-smoke.sh "$BASE_URL"
./tests/agent-browser/layout-assert.sh "$BASE_URL"
