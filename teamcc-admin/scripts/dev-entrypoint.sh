#!/usr/bin/env sh
set -eu

db_host="${DB_HOST:-postgres}"
db_port="${DB_PORT:-5432}"

if [ ! -x node_modules/.bin/tsx ]; then
  echo "Installing API dependencies..."
  npm install
fi

echo "Waiting for PostgreSQL at ${db_host}:${db_port}..."
until node -e "const net = require('node:net'); const socket = net.connect({ host: process.env.DB_HOST || 'postgres', port: Number(process.env.DB_PORT || '5432') }, () => { socket.end(); process.exit(0); }); socket.on('error', () => process.exit(1));"; do
  sleep 1
done

echo "Applying database schema..."
npm run db:push

echo "Seeding development data..."
npm run seed

echo "Starting API server..."
exec npm run dev
