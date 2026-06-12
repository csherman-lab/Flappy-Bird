#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8080}"

if [ ! -f "index.html" ]; then
  echo "ERROR: index.html not found in $(pwd)"
  echo "Make sure you are in the Flappy-Bird folder and on the right branch:"
  echo "  git checkout cursor/realistic-3d-flappy-bird-d4fe"
  exit 1
fi

echo "Starting Flappy Bird 3D on http://localhost:${PORT}"
echo "Press Ctrl+C to stop."
echo ""

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
else
  exec npx --yes serve . -l "$PORT"
fi
