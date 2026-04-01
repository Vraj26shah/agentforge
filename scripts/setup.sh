#!/bin/bash

# AgentForge Setup Script
# Prepares the project for first-time development

set -e

echo "🚀 AgentForge Project Setup"
echo "=============================="
echo ""

# Check prerequisites
echo "✓ Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install it."
    exit 1
fi

echo "✓ Docker and Docker Compose found"
echo ""

# Environment setup
echo "📝 Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created .env file from template"
    echo "⚠️  Please edit .env and add your Claude API key before proceeding"
else
    echo "✓ .env file already exists"
fi

echo ""

# Create directories
echo "📁 Creating directories..."
mkdir -p backend/app spacetimedb/src frontend/src/{components} scripts

echo "✓ Directories created"
echo ""

# Start services
echo "🐳 Starting Docker services..."
echo "This may take a few minutes on first run..."
docker-compose up --build -d

echo ""
echo "✓ Services started!"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service health..."

if curl -s http://localhost:8000/health > /dev/null; then
    echo "✓ Backend is healthy"
else
    echo "⚠️  Backend may still be starting..."
fi

if curl -s http://localhost:8080 > /dev/null; then
    echo "✓ SpacetimeDB is responding"
else
    echo "⚠️  SpacetimeDB may still be starting..."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your API keys"
echo "2. Visit http://localhost:5173 to see the frontend"
echo "3. Run 'docker-compose logs -f' to watch the services"
echo "4. Run 'bash scripts/demo.sh' to test the system"
echo ""
