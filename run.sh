#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

echo "▶️  Third Space dev runner"
echo "   Working directory: $(pwd)"
echo

if [ ! -f node_modules/.bin/vite ]; then
  if [ -f package-lock.json ]; then
    echo "📦 Installing dependencies with npm ci…"
    SUPABASE_SKIP_POSTINSTALL=1 npm ci --ignore-scripts
  else
    echo "📦 Installing dependencies with npm install…"
    SUPABASE_SKIP_POSTINSTALL=1 npm install --ignore-scripts
  fi
fi

echo
echo "🚀 Starting Vite dev server (npm run dev)…"
echo "   Hit Ctrl+C to stop the server."
echo

npm run dev

