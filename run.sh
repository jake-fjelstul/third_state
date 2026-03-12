#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

echo "▶️  Third Space dev runner"
echo "   Working directory: $(pwd)"
echo

if [ -f package-lock.json ]; then
  echo "📦 Installing dependencies with npm ci (clean, lockfile-based install)…"
  npm ci
else
  echo "📦 Installing dependencies with npm install…"
  npm install
fi

echo
echo "🚀 Starting Vite dev server (npm run dev)…"
echo "   Hit Ctrl+C to stop the server."
echo

npm run dev

