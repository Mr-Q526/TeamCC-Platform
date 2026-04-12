#!/usr/bin/env sh
set -eu

if [ ! -x node_modules/.bin/vite ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

echo "Starting Vite dev server..."
exec npm run dev -- --host 0.0.0.0 --port 5173
