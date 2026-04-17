#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# AgentForge - Unified Management Script
# Single script for verify, setup, and demo operations
# ═══════════════════════════════════════════════════════════════

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

load_env() {
    if [ -f .env ]; then
        set -a
        source .env
        set +a
        return 0
    else
        return 1
    fi
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description - MISSING: $file"
        return 1
    fi
}

check_dir() {
    local dir=$1
    local description=$2

    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description - MISSING: $dir"
        return 1
    fi
}

check_env() {
    local var=$1
    local description=$2

    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}⚠${NC} $description - Not set"
        return 1
    else
        echo -e "${GREEN}✓${NC} $description - Set"
        return 0
    fi
}

check_command() {
    local cmd=$1
    local description=$2

    if command -v $cmd &> /dev/null; then
        if [ "$cmd" = "docker-compose" ] || [ "$cmd" = "docker" ] || [ "$cmd" = "python3" ] || [ "$cmd" = "node" ]; then
            local version=$($cmd --version 2>&1 | head -1)
            echo -e "${GREEN}✓${NC} $description ($version)"
        else
            echo -e "${GREEN}✓${NC} $description"
        fi
        return 0
    else
        echo -e "${RED}✗${NC} $description not installed"
        return 1
    fi
}

check_docker_daemon() {
    if ! docker ps &> /dev/null; then
        return 1
    fi
    return 0
}

# ═══════════════════════════════════════════════════════════════
# VERIFY Command
# ═══════════════════════════════════════════════════════════════

cmd_verify() {
    print_header "AgentForge Project Verification"

    ERRORS=0
    WARNINGS=0

    # Load environment
    if load_env; then
        echo -e "${GREEN}✓${NC} Loaded environment from .env"
    else
        echo -e "${YELLOW}⚠${NC} .env file not found - skipping env checks"
        WARNINGS=$((WARNINGS + 1))
    fi
    echo ""

    # Check project structure
    echo "📁 Checking project structure..."
    echo ""
    check_file "CLAUDE.md" "Main documentation" || ERRORS=$((ERRORS + 1))
    check_file ".env" "Environment configuration" || ERRORS=$((ERRORS + 1))
    check_file "docker-compose.yml" "Docker Compose config" || ERRORS=$((ERRORS + 1))
    echo ""

    # Check backend files
    echo "📦 Backend files..."
    check_dir "backend" "Backend directory" || ERRORS=$((ERRORS + 1))
    check_file "backend/Dockerfile" "Backend Dockerfile" || ERRORS=$((ERRORS + 1))
    check_file "backend/requirements.txt" "Python dependencies" || ERRORS=$((ERRORS + 1))
    check_file "backend/app/main.py" "FastAPI application" || ERRORS=$((ERRORS + 1))
    check_file "backend/app/armoriq_integration.py" "ArmorIQ implementation" || ERRORS=$((ERRORS + 1))
    check_file "backend/app/agents.py" "Agent definitions" || ERRORS=$((ERRORS + 1))
    check_file "backend/app/orchestrator.py" "Task orchestrator" || ERRORS=$((ERRORS + 1))
    check_file "backend/app/spacetime.py" "Database integration" || ERRORS=$((ERRORS + 1))
    echo ""

    # Check frontend files
    echo "🎨 Frontend files..."
    check_dir "frontend" "Frontend directory" || ERRORS=$((ERRORS + 1))
    check_file "frontend/Dockerfile" "Frontend Dockerfile" || ERRORS=$((ERRORS + 1))
    check_file "frontend/package.json" "Node dependencies" || ERRORS=$((ERRORS + 1))
    check_file "frontend/vite.config.ts" "Vite config" || ERRORS=$((ERRORS + 1))
    check_file "frontend/tailwind.config.js" "Tailwind config" || ERRORS=$((ERRORS + 1))
    check_file "frontend/src/App.tsx" "React App component" || ERRORS=$((ERRORS + 1))
    check_file "frontend/src/main.tsx" "React entry point" || ERRORS=$((ERRORS + 1))
    check_file "frontend/src/components/Dashboard.tsx" "Dashboard component" || ERRORS=$((ERRORS + 1))
    echo ""

    # Check database files
    echo "🗄️  Database files..."
    check_dir "spacetimedb" "SpacetimeDB directory" || ERRORS=$((ERRORS + 1))
    check_file "spacetimedb/Cargo.toml" "Rust dependencies" || ERRORS=$((ERRORS + 1))
    check_file "spacetimedb/src/lib.ts" "Database schema" || ERRORS=$((ERRORS + 1))
    echo ""

    # Check scripts
    echo "🛠️  Scripts..."
    check_file "agentforge.sh" "Main management script" || ERRORS=$((ERRORS + 1))
    echo ""

    # Check configuration
    echo "⚙️  Configuration..."
    check_file "claude/settings.json" "Claude Code settings" || ERRORS=$((ERRORS + 1))
    echo ""

    # Check environment variables
    echo "🌍 Environment variables from .env..."
    echo ""
    check_env "OLLAMA_API_URL" "Ollama API URL" || WARNINGS=$((WARNINGS + 1))
    check_env "OLLAMA_MODEL" "Ollama Model" || WARNINGS=$((WARNINGS + 1))
    check_env "GEMINI_API_KEY" "Gemini API Key" || WARNINGS=$((WARNINGS + 1))
    check_env "ARMORIQ_API_KEY" "ArmorIQ API Key" || WARNINGS=$((WARNINGS + 1))
    check_env "BACKEND_URL" "Backend URL" || WARNINGS=$((WARNINGS + 1))
    check_env "FRONTEND_URL" "Frontend URL" || WARNINGS=$((WARNINGS + 1))
    check_env "SPACETIMEDB_URL" "SpacetimeDB URL" || WARNINGS=$((WARNINGS + 1))
    echo ""

    # Check dependencies
    echo "📚 Dependencies..."
    echo ""
    check_command "docker" "Docker" || ERRORS=$((ERRORS + 1))
    check_command "docker-compose" "Docker Compose" || ERRORS=$((ERRORS + 1))
    check_command "python3" "Python 3" || ERRORS=$((ERRORS + 1))
    check_command "node" "Node.js" || WARNINGS=$((WARNINGS + 1))
    echo ""

    # Python syntax check
    echo "🐍 Python syntax check..."
    echo ""
    if python3 -m py_compile backend/app/*.py 2>/dev/null; then
        echo -e "${GREEN}✓${NC} All Python files are syntactically correct"
    else
        echo -e "${RED}✗${NC} Python syntax errors found"
        ERRORS=$((ERRORS + 1))
    fi
    echo ""

    # Summary
    echo "═══════════════════════════════════════════════════════════════"
    if [ $ERRORS -eq 0 ]; then
        echo -e "${GREEN}✓ Verification Complete!${NC}"
    else
        echo -e "${RED}✗ Verification Failed! (Errors: $ERRORS)${NC}"
    fi

    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    fi

    echo ""
    echo "Next: Run 'bash agentforge.sh setup' to initialize the project"
    echo ""

    return $ERRORS
}

# ═══════════════════════════════════════════════════════════════
# SETUP Command
# ═══════════════════════════════════════════════════════════════

cmd_setup() {
    print_header "AgentForge Setup & Initialization"

    # Load environment
    if ! load_env; then
        echo -e "${RED}❌ .env file not found!${NC}"
        echo "Please create .env file with required configuration."
        return 1
    fi

    echo -e "${GREEN}✓${NC} Loaded environment from .env"
    echo ""

    # Check prerequisites
    echo "🔍 Checking prerequisites..."
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
        return 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed. Please install it.${NC}"
        return 1
    fi

    echo -e "${GREEN}✓${NC} Docker and Docker Compose found"
    echo ""

    # Ensure Docker daemon is running (Linux specific)
    echo "🔧 Ensuring Docker daemon is running..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if ! check_docker_daemon; then
            echo -e "${YELLOW}⚠${NC} Docker daemon not accessible. Attempting to start..."
            if sudo systemctl is-active --quiet docker; then
                echo -e "${GREEN}✓${NC} Docker daemon is running (via systemctl)"
            else
                echo "Attempting to start Docker daemon..."
                if ! sudo systemctl start docker 2>/dev/null; then
                    echo -e "${RED}❌ Could not start Docker daemon.${NC}"
                    echo "Run manually: sudo systemctl start docker"
                    return 1
                fi
                sleep 2
                echo -e "${GREEN}✓${NC} Docker daemon started"
            fi
        else
            echo -e "${GREEN}✓${NC} Docker daemon is accessible"
        fi
    else
        if ! check_docker_daemon; then
            echo -e "${RED}❌ Docker daemon is not running!${NC}"
            echo "Please start Docker first:"
            echo "   • Mac: Open 'Docker.app' from Applications"
            echo "   • Windows: Open 'Docker Desktop' from Start Menu"
            echo "After starting Docker, run: bash agentforge.sh setup"
            return 1
        fi
        echo -e "${GREEN}✓${NC} Docker daemon is running"
    fi
    echo ""

    # Verify environment configuration
    echo "⚙️  Verifying environment configuration..."
    REQUIRED_VARS=("OLLAMA_API_URL" "OLLAMA_MODEL" "GEMINI_API_KEY" "ARMORIQ_API_KEY" "BACKEND_URL" "FRONTEND_URL")

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}❌ Missing required variable: $var${NC}"
            return 1
        fi
    done

    echo -e "${GREEN}✓${NC} All required environment variables are set"
    echo ""

    # Create directories
    echo "📁 Creating project directories..."
    mkdir -p backend/app spacetimedb/src frontend/src/{components}
    echo -e "${GREEN}✓${NC} Directories created"
    echo ""

    # Clean up old containers and processes
    echo "🧹 Cleaning up old containers and processes..."
    echo ""

    # Stop and remove old containers
    if docker-compose ps 2>/dev/null | grep -q "agentforge"; then
        echo "   Stopping existing containers..."
        docker-compose down --remove-orphans 2>/dev/null || true
        sleep 2
    fi

    # Remove dangling containers
    echo "   Removing dangling containers..."
    docker container prune -f --filter "until=1h" 2>/dev/null || true

    # Kill any process on the required ports
    echo "   Checking for processes on required ports..."
    for port in 8000 5173 3000 3001; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "   Found process on port $port, cleaning up..."
            kill -9 $(lsof -t -i:$port) 2>/dev/null || true
            sleep 1
        fi
    done

    echo -e "${GREEN}✓${NC} Cleanup complete"
    echo ""

    # Start services
    echo "🐳 Starting Docker services..."
    echo "This may take a few minutes on first run..."
    echo ""

    if ! docker-compose up --build -d 2>&1 | tee /tmp/docker-compose.log; then
        echo ""
        echo -e "${RED}❌ Failed to start Docker services!${NC}"
        echo ""
        echo "Error details:"
        tail -30 /tmp/docker-compose.log
        echo ""
        echo "Troubleshooting:"
        echo "  1. Check Docker daemon: docker ps"
        echo "  2. View detailed logs: docker-compose logs"
        echo "  3. Check port conflicts: lsof -i -P -n | grep LISTEN"
        echo "  4. Try again: bash agentforge.sh setup"
        return 1
    fi

    echo ""
    echo -e "${GREEN}✓${NC} Docker services started!"
    echo ""

    # Wait for services with progress indicator
    echo "⏳ Waiting for services to be ready..."
    sleep 3

    RETRIES=0
    MAX_RETRIES=30

    while [ $RETRIES -lt $MAX_RETRIES ]; do
        READY=0

        # Check backend
        if curl -s $BACKEND_URL/health > /dev/null 2>&1; then
            READY=$((READY + 1))
        fi

        # Check frontend (just check if port is open)
        if nc -z localhost 5173 2>/dev/null || curl -s http://localhost:5173 > /dev/null 2>&1; then
            READY=$((READY + 1))
        fi

        if [ $READY -eq 2 ]; then
            break
        fi

        echo -n "."
        sleep 1
        RETRIES=$((RETRIES + 1))
    done

    echo ""
    echo ""

    # Check service health
    echo "🔍 Checking service health..."
    echo ""

    if curl -s $BACKEND_URL/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Backend is healthy ($BACKEND_URL)"
    else
        echo -e "${YELLOW}⚠${NC} Backend is starting..."
    fi

    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend is responding (http://localhost:5173)"
    else
        echo -e "${YELLOW}⚠${NC} Frontend is starting..."
    fi

    if docker ps | grep -q spacetimedb; then
        echo -e "${GREEN}✓${NC} SpacetimeDB container is running"
    else
        echo -e "${YELLOW}⚠${NC} SpacetimeDB may still be starting..."
    fi

    echo ""
    print_header "Setup Complete! ✅"

    echo "📊 Multi-Agent Configuration:"
    echo "   - Analyzer & Validator: Ollama (${OLLAMA_MODEL})"
    echo "   - Executor & Reporter: Gemini API"
    echo "   - Security: ArmorIQ"
    echo ""
    echo "🌐 Service URLs:"
    echo "   - Frontend: ${FRONTEND_URL} (or http://localhost:5173)"
    echo "   - Backend:  ${BACKEND_URL}"
    echo "   - Database: ${SPACETIMEDB_URL}"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Open frontend: ${FRONTEND_URL}"
    echo "   2. View logs: docker-compose logs -f"
    echo "   3. Run demo: bash agentforge.sh demo"
    echo "   4. Stop services: docker-compose down"
    echo ""

    return 0
}

# ═══════════════════════════════════════════════════════════════
# DEMO Command
# ═══════════════════════════════════════════════════════════════

cmd_demo() {
    print_header "AgentForge Multi-User Demo"

    # Load environment
    if ! load_env; then
        echo -e "${RED}❌ .env file not found!${NC}"
        echo "Please run: bash agentforge.sh setup"
        return 1
    fi

    echo -e "${GREEN}✓${NC} Loaded environment configuration"
    echo ""

    # Check backend
    echo "🔍 Checking backend connectivity..."
    echo "   Backend URL: $BACKEND_URL"

    if ! curl -s $BACKEND_URL/health > /dev/null 2>&1; then
        echo -e "${RED}❌ Backend is not running. Start it with: bash agentforge.sh setup${NC}"
        echo "To check status: docker-compose logs backend"
        return 1
    fi

    echo -e "${GREEN}✓${NC} Backend is running"
    echo ""

    # Check Ollama
    echo "🔍 Checking Ollama connection..."
    if curl -s $OLLAMA_API_URL/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Ollama is running (${OLLAMA_MODEL})"
    else
        echo -e "${YELLOW}⚠${NC} Warning: Ollama may not be running at $OLLAMA_API_URL"
        echo "   Start Ollama with: ollama serve"
    fi
    echo ""

    # Generate unique user IDs for demo
    USER_A="demo-user-$(openssl rand -hex 4)"
    USER_B="demo-user-$(openssl rand -hex 4)"

    echo "👥 Simulating 2 concurrent users:"
    echo "   User A: $USER_A"
    echo "   User B: $USER_B"
    echo ""

    # Submit User A request
    echo "📤 Submitting User A's request..."
    REQUEST_A="Analyze sales trends for Q1 and summarize insights"
    echo "   Request: '$REQUEST_A'"
    echo ""

    curl -s -X POST $BACKEND_URL/api/jailbreak \
      -H "Content-Type: application/json" \
      -d "{
        \"user_request\": \"$REQUEST_A\",
        \"user_id\": \"$USER_A\",
        \"context\": {
          \"demo\": true,
          \"user\": \"A\",
          \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }
      }" > /tmp/user_a_response.json 2>&1 &

    PID_A=$!

    # Small stagger so the pipeline steps interleave visually
    sleep 0.5

    # Submit User B request
    echo "📤 Submitting User B's request (0.5s later)..."
    REQUEST_B="Review the codebase for security vulnerabilities"
    echo "   Request: '$REQUEST_B'"
    echo ""

    curl -s -X POST $BACKEND_URL/api/jailbreak \
      -H "Content-Type: application/json" \
      -d "{
        \"user_request\": \"$REQUEST_B\",
        \"user_id\": \"$USER_B\",
        \"context\": {
          \"demo\": true,
          \"user\": \"B\",
          \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }
      }" > /tmp/user_b_response.json 2>&1 &

    PID_B=$!

    # Wait for both requests to complete
    wait $PID_A $PID_B

    echo ""
    echo "📨 User A Response:"
    cat /tmp/user_a_response.json | jq . 2>/dev/null || cat /tmp/user_a_response.json
    echo ""

    echo "📨 User B Response:"
    cat /tmp/user_b_response.json | jq . 2>/dev/null || cat /tmp/user_b_response.json
    echo ""

    echo -e "${GREEN}✅ Both tasks submitted!${NC}"
    echo ""

    echo "📊 Multi-Agent Pipeline Status:"
    echo "   Step 1 (0-25%): Analyzer (Ollama) → Fast request analysis"
    echo "   Step 2 (25-50%): Executor (Gemini) → Accurate execution"
    echo "   Step 3 (50-75%): Validator (Ollama) → Result verification"
    echo "   Step 4 (75-100%): Reporter (Gemini) → Report generation"
    echo ""

    echo "🔍 What to observe:"
    echo "   ✓ Dashboard shows both users' tasks in separate sections"
    echo "   ✓ TaskFlow shows pipeline progress for both tasks"
    echo "   ✓ AgentBoard shows which user's task each agent is processing"
    echo "   ✓ Header shows 'Live Users' counter (if using browser)"
    echo ""

    echo "📋 Next steps:"
    echo "   1. Open browser: ${FRONTEND_URL}"
    echo "   2. See 'My Tasks' vs 'Other Users' sections"
    echo "   3. Monitor both tasks executing in parallel"
    echo "   4. Watch the 'Live Users' badge at the top"
    echo "   5. Open another browser tab to see multi-user sync"
    echo ""
    echo "💡 Tip: Run 'docker-compose logs -f backend' to see execution logs"
    echo ""

    return 0
}

# ═══════════════════════════════════════════════════════════════
# STATUS Command
# ═══════════════════════════════════════════════════════════════

cmd_status() {
    print_header "System Status Check"

    echo "🔍 Checking Docker..."
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker is installed"
        echo "   Version: $(docker --version)"
    else
        echo -e "${RED}✗${NC} Docker is not installed"
        return 1
    fi

    if check_docker_daemon; then
        echo -e "${GREEN}✓${NC} Docker daemon is running"
    else
        echo -e "${RED}✗${NC} Docker daemon is NOT running"
        echo ""
        echo "Start Docker with:"
        echo "   • Linux: sudo systemctl start docker"
        echo "   • Mac: Open Docker.app from Applications"
        echo "   • Windows: Open Docker Desktop from Start Menu"
        return 1
    fi

    echo ""
    echo "🔍 Checking Docker Compose..."
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker Compose is installed"
        echo "   Version: $(docker-compose --version)"
    else
        echo -e "${RED}✗${NC} Docker Compose is not installed"
        return 1
    fi

    echo ""
    echo "📦 Running containers:"
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q agentforge; then
        docker ps --filter "name=agentforge" --format "table {{.Names}}\t{{.Status}}"
    else
        echo "   No AgentForge containers running"
        echo "   Run: bash agentforge.sh setup"
    fi

    echo ""
    echo -e "${GREEN}✓${NC} System check complete!"
    return 0
}

# ═══════════════════════════════════════════════════════════════
# HELP Command
# ═══════════════════════════════════════════════════════════════

show_help() {
    cat << 'EOF'

╔═══════════════════════════════════════════════════════════════╗
║          AgentForge - Unified Management Script               ║
║                                                               ║
║  Single script for verify, setup, and demo operations        ║
╚═══════════════════════════════════════════════════════════════╝

USAGE:
    bash agentforge.sh [command]

COMMANDS:
    health    - Check if all services are running
                Verifies ArmorIQ, Ollama, Gemini, SpacetimeDB, Backend, Frontend
                Usage: bash agentforge.sh health
                Use this to verify everything is working!

    status    - Check Docker and system configuration
                Verifies Docker daemon, containers, and basic setup
                Usage: bash agentforge.sh status
                Use this first if docker-compose fails!

    verify    - Verify project setup and configuration
                Checks files, directories, dependencies, and env vars
                Usage: bash agentforge.sh verify

    setup     - Initialize and start all services
                Loads .env, validates config, starts Docker services
                Usage: bash agentforge.sh setup
                Prerequisite: .env file must exist with API keys

    demo      - Run demo request through the system
                Submits sample request and shows multi-agent pipeline
                Usage: bash agentforge.sh demo
                Prerequisite: Services must be running (setup completed)

    help      - Show this help message
                Usage: bash agentforge.sh help

QUICK START:
    1. Start all services:
       bash start.sh

    2. Check service health:
       bash agentforge.sh health

    3. Run demo:
       bash agentforge.sh demo

DETAILED SETUP:
    1. Check system status:
       bash agentforge.sh status

    2. Verify setup:
       bash agentforge.sh verify

    3. Initialize services:
       bash agentforge.sh setup

TROUBLESHOOTING:
    Docker not running error?
    → bash agentforge.sh status
    → Then start Docker and run: bash agentforge.sh setup

    Docker not found error?
    → Install Docker Desktop from https://www.docker.com/products/docker-desktop

    Services failing to start?
    → docker-compose logs -f          # View real-time logs
    → docker ps                       # Check running containers
    → bash agentforge.sh status       # Check system status

    Port conflicts?
    → netstat -an | grep -E ':(8000|5173|3000)'
    → Stop conflicting services or change ports in docker-compose.yml

ENVIRONMENT:
    .env file is required with these variables:
    - OLLAMA_API_URL          (http://localhost:11434)
    - OLLAMA_MODEL            (mistral)
    - GEMINI_API_KEY          (your Gemini API key)
    - ARMORIQ_API_KEY         (your ArmorIQ API key)
    - BACKEND_URL             (http://localhost:8001)
    - FRONTEND_URL            (http://localhost:5174)
    - SPACETIMEDB_URL         (http://localhost:3001)

CONFIGURATION:
    Frontend:  http://localhost:5174
    Backend:   http://localhost:8001
    Database:  http://localhost:3001

MULTI-AGENT PIPELINE:
    Step 1 (25%): Analyzer (Ollama)    → Fast request analysis
    Step 2 (50%): Executor (Gemini)    → Accurate execution
    Step 3 (75%): Validator (Ollama)   → Result verification
    Step 4 (100%): Reporter (Gemini)   → Report generation

EOF
}

# ═══════════════════════════════════════════════════════════════
# Main Entry Point
# ═══════════════════════════════════════════════════════════════

main() {
    local command=${1:-help}

    case "$command" in
        health)
            if [ -f "health.sh" ]; then
                bash health.sh
                exit $?
            else
                echo -e "${RED}Error: health.sh not found${NC}"
                exit 1
            fi
            ;;
        status)
            cmd_status
            exit $?
            ;;
        verify)
            cmd_verify
            exit $?
            ;;
        setup)
            cmd_setup
            exit $?
            ;;
        demo)
            cmd_demo
            exit $?
            ;;
        help|--help|-h)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main
main "$@"
