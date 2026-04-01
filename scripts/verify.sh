#!/bin/bash

# AgentForge Project Verification Script
# Checks that all components are properly set up

set -e

echo "🔍 AgentForge Project Verification"
echo "===================================="
echo ""

ERRORS=0
WARNINGS=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
    else
        echo -e "${RED}✗${NC} $description - MISSING: $file"
        ERRORS=$((ERRORS + 1))
    fi
}

check_dir() {
    local dir=$1
    local description=$2

    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description"
    else
        echo -e "${RED}✗${NC} $description - MISSING: $dir"
        ERRORS=$((ERRORS + 1))
    fi
}

check_env() {
    local var=$1
    local description=$2

    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}⚠${NC} $description - Not set"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓${NC} $description - Set"
    fi
}

# Check project structure
echo "📁 Checking project structure..."
echo ""

check_file "CLAUDE.md" "Main documentation"
check_file "ARMORQ_SETUP.md" "ArmorQ documentation"
check_file ".env.example" "Environment template"
check_file "docker-compose.yml" "Docker Compose config"

echo ""
echo "📦 Backend files..."
check_dir "backend" "Backend directory"
check_file "backend/Dockerfile" "Backend Dockerfile"
check_file "backend/requirements.txt" "Python dependencies"
check_file "backend/app/main.py" "FastAPI application"
check_file "backend/app/armorio.py" "ArmorQ implementation"
check_file "backend/app/agents.py" "Agent definitions"
check_file "backend/app/orchestrator.py" "Task orchestrator"
check_file "backend/app/spacetime.py" "Database integration"

echo ""
echo "🎨 Frontend files..."
check_dir "frontend" "Frontend directory"
check_file "frontend/Dockerfile" "Frontend Dockerfile"
check_file "frontend/package.json" "Node dependencies"
check_file "frontend/vite.config.ts" "Vite config"
check_file "frontend/tailwind.config.js" "Tailwind config"
check_file "frontend/src/App.tsx" "React App component"
check_file "frontend/src/main.tsx" "React entry point"
check_file "frontend/src/components/Dashboard.tsx" "Dashboard component"

echo ""
echo "🗄️  Database files..."
check_dir "spacetimedb" "SpacetimeDB directory"
check_file "spacetimedb/Cargo.toml" "Rust dependencies"
check_file "spacetimedb/src/lib.ts" "Database schema"

echo ""
echo "🛠️  Scripts..."
check_file "scripts/setup.sh" "Setup script"
check_file "scripts/demo.sh" "Demo script"
check_file "scripts/verify.sh" "Verification script"

echo ""
echo "⚙️  Configuration..."
check_file "claude/settings.json" "Claude Code settings"

# Check environment
echo ""
echo "🌍 Environment variables..."
echo ""

check_env "CLAUDE_API_KEY" "Claude API key"

# Check dependencies
echo ""
echo "📚 Dependencies..."
echo ""

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker installed"
else
    echo -e "${RED}✗${NC} Docker not installed"
    ERRORS=$((ERRORS + 1))
fi

if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker Compose installed"
else
    echo -e "${RED}✗${NC} Docker Compose not installed"
    ERRORS=$((ERRORS + 1))
fi

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo -e "${GREEN}✓${NC} Python 3 installed ($PYTHON_VERSION)"
else
    echo -e "${RED}✗${NC} Python 3 not installed"
    ERRORS=$((ERRORS + 1))
fi

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js installed ($NODE_VERSION)"
else
    echo -e "${YELLOW}⚠${NC} Node.js not installed (needed for frontend dev)"
    WARNINGS=$((WARNINGS + 1))
fi

# Python syntax check
echo ""
echo "🐍 Python syntax check..."
echo ""

if python3 -m py_compile backend/app/*.py 2>/dev/null; then
    echo -e "${GREEN}✓${NC} All Python files are syntactically correct"
else
    echo -e "${RED}✗${NC} Python syntax errors found"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ Verification Complete!${NC}"
else
    echo -e "${RED}✗ Verification Failed!${NC}"
    echo -e "${RED}Errors: $ERRORS${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
fi

echo ""
echo "Next steps:"
echo "1. Edit .env with your Claude API key: cp .env.example .env"
echo "2. Run: docker-compose up --build"
echo "3. Visit: http://localhost:5173"
echo "4. Test: bash scripts/demo.sh"
echo ""

exit $ERRORS
