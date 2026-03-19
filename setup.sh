#!/bin/bash

# Filteral Setup Script
# Run this after cloning to set up the development environment

set -e

echo "==================================="
echo "  Filteral Development Setup"
echo "==================================="

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3.11+"
    exit 1
fi

echo "✓ Node.js $(node -v)"
echo "✓ Python $(python3 --version)"

# Copy env file if not exists
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "IMPORTANT: Edit .env with your API keys before proceeding!"
    echo "At minimum, you need:"
    echo "  - OPENAI_API_KEY"
    echo "  - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# Setup web
echo ""
echo "Setting up web (Next.js)..."
cd web

if [ ! -d node_modules ]; then
    echo "Installing npm dependencies..."
    npm install
fi

echo "Generating Prisma client..."
npx prisma generate

# Copy env to web if needed
if [ ! -f .env ]; then
    cp ../.env .env
fi

cd ..

# Setup worker
echo ""
echo "Setting up worker (Python)..."
cd worker

if [ ! -d venv ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing Playwright browsers..."
playwright install chromium

cd ..

# Check database
echo ""
echo "Checking database..."

if command -v psql &> /dev/null; then
    if psql -lqt | cut -d \| -f 1 | grep -qw dailyrec; then
        echo "✓ Database 'dailyrec' exists"
    else
        echo "Creating database 'dailyrec'..."
        createdb dailyrec 2>/dev/null || echo "Could not create database. Create it manually."
    fi
else
    echo "PostgreSQL CLI not found. Make sure PostgreSQL is running and 'dailyrec' database exists."
fi

# Run migrations
echo ""
echo "Running database migrations..."
cd web
npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
cd ..

echo ""
echo "==================================="
echo "  Setup Complete!"
echo "==================================="
echo ""
echo "To start development servers:"
echo ""
echo "  Terminal 1 (Web):"
echo "    cd web && npm run dev"
echo ""
echo "  Terminal 2 (Worker):"
echo "    cd worker && source venv/bin/activate && python -m uvicorn app:app --port 3001 --reload"
echo ""
echo "Or use Docker:"
echo "    docker-compose -f docker-compose.dev.yml up"
echo ""
echo "Access the app at: http://localhost:3000"
echo ""
