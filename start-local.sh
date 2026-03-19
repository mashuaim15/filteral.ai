#!/bin/bash
# Filteral Local Development Startup Script

set -e

# Resolve absolute path to this script's directory
SCRIPT_DIR="$(cd "$SCRIPT_DIR" && pwd)"

echo "Starting Filteral local development environment..."

# Start PostgreSQL container (with seed data)
if [ ! "$(docker ps -q -f name=dailyrec-db)" ]; then
    if [ "$(docker ps -aq -f name=dailyrec-db)" ]; then
        echo "Starting existing database container..."
        docker start dailyrec-db
    else
        echo "Creating new database container with seed data..."
        docker run -d --name dailyrec-db -p 5433:5432 \
          -e POSTGRES_DB=dailyrec \
          -e POSTGRES_USER=postgres \
          -e POSTGRES_PASSWORD=postgres \
          -v "$SCRIPT_DIR/docker/init.sql:/docker-entrypoint-initdb.d/init.sql" \
          postgres:14-alpine
    fi
    echo "Waiting for database to be ready..."
    sleep 5
else
    echo "Database container already running."
fi

# Verify database is ready
until docker exec dailyrec-db pg_isready -U postgres > /dev/null 2>&1; do
    echo "Waiting for database..."
    sleep 1
done
echo "Database is ready!"

# Seed default users
echo "Seeding default users..."
cd "$SCRIPT_DIR/web"
npx prisma db seed

# Load environment variables from web/.env
export $(grep -E '^OPENAI_API_KEY=' "$SCRIPT_DIR/web/.env.local" | xargs)

# Start worker service
echo "Starting worker service on port 3001..."
cd "$SCRIPT_DIR/worker"
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
fi
uvicorn app:app --host 0.0.0.0 --port 3001 --reload &
WORKER_PID=$!

# Start web service
echo "Starting web service on port 3000..."
cd "$SCRIPT_DIR/web"
npm run dev &
WEB_PID=$!

echo ""
echo "============================================"
echo "Filteral is running!"
echo "============================================"
echo "Web:      http://localhost:3000"
echo "Worker:   http://localhost:3001"
echo "Database: postgresql://postgres:postgres@localhost:5433/dailyrec"
echo ""
echo "Login: admin / admin (PRO)"
echo ""
echo "Press Ctrl+C to stop all services"
echo "============================================"

# Wait for Ctrl+C
trap "echo 'Stopping services...'; kill $WORKER_PID $WEB_PID 2>/dev/null; docker stop dailyrec-db; exit 0" SIGINT SIGTERM
wait
