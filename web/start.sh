#!/bin/sh
set -e

echo "Syncing database schema..."
prisma db push --accept-data-loss

echo "Starting server..."
exec node server.js
