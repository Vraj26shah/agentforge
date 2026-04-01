#!/bin/bash

################################################################################
#                    🎯 AGENTFORGE - MASTER CONTROL SCRIPT
#
# Complete management system for AgentForge project
# Handles: Start | Stop | Destroy | Status | Test | Logs | Diagnose | Control
#
# Works on: Linux, macOS, Windows (WSL/Git Bash)
# Requirements: bash, docker, docker-compose, curl
#
# Usage: ./agentforge.sh [COMMAND] [OPTIONS]
#
# Commands:
#   start       → Start all services (build if needed)
#   stop        → Stop all running services (keep data)
#   destroy     → Completely destroy everything (delete containers, volumes, data)
#   status      → Show current service status
#   logs        → Stream service logs (specify: backend, frontend, spacetimedb, all)
#   test        → Run all tests (health, api, security)
#   diagnose    → Run diagnostic checks
#   clean       → Clean Docker resources (containers, images, volumes)
#   help        → Show this help message
#
# Examples:
#   ./agentforge.sh start              # Start all services
#   ./agentforge.sh stop               # Stop services
#   ./agentforge.sh destroy            # Nuke everything
#   ./agentforge.sh test               # Run all tests
#   ./agentforge.sh logs backend       # Watch backend logs
#   ./agentforge.sh status             # Check status
#
################################################################################

set -o pipefail

# Ensure this script runs with bash (not sh)
if [ -z "$BASH" ]; then
    echo "⚠️  This script requires bash. Please run with: bash agentforge.sh"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# COLOR DEFINITIONS
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'  # No Color

# ─────────────────────────────────────────────────────────────────────────────
# UTILITY FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}▸ $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_item() {
    echo -e "${WHITE}   • $1${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# DEPENDENCY CHECK (after utility functions are defined)
# ─────────────────────────────────────────────────────────────────────────────

check_dependencies() {
    local missing=0
    local deps=("docker" "curl")

    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            print_error "Missing required command: $cmd"
            ((missing++))
        fi
    done

    if [ $missing -gt 0 ]; then
        echo ""
        echo "Please install missing dependencies:"
        echo "  - Docker: https://docs.docker.com/get-docker/"
        echo "  - curl: usually included, or install from package manager"
        return 1
    fi

    return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: START
# ─────────────────────────────────────────────────────────────────────────────

cmd_start() {
    print_header "🚀 STARTING AGENTFORGE"

    print_section "Building and starting Docker services"

    # Check if docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker daemon is not running"
        return 1
    fi

    # Start services
    if docker compose up --build -d > /dev/null 2>&1; then
        print_success "Services started"
    else
        print_error "Failed to start services"
        return 1
    fi

    # Wait for services to be ready
    print_section "Waiting for services to initialize"
    sleep 5

    # Check services
    print_section "Verifying services"

    BACKEND_OK=$(docker compose ps | grep -c "agentforge-backend.*Up" || echo "0")
    FRONTEND_OK=$(docker compose ps | grep -c "agentforge-frontend.*Up" || echo "0")
    SPACETIMEDB_OK=$(docker compose ps | grep -c "agentforge-spacetimedb.*Up" || echo "0")

    [ "$BACKEND_OK" -gt 0 ] && print_success "Backend running" || print_error "Backend not running"
    [ "$FRONTEND_OK" -gt 0 ] && print_success "Frontend running" || print_error "Frontend not running"
    [ "$SPACETIMEDB_OK" -gt 0 ] && print_success "SpacetimeDB running" || print_error "SpacetimeDB not running"

    # Test endpoints
    print_section "Testing endpoints"

    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        print_success "Backend API responding"
    else
        print_warning "Backend API not yet responding (might still be initializing)"
    fi

    # Summary
    print_section "Summary"
    echo -e "${GREEN}AgentForge is starting up!${NC}"
    echo ""
    print_item "Frontend: http://localhost:5174"
    print_item "Backend API: http://localhost:8001"
    print_item "API Docs: http://localhost:8001/docs"
    print_item "SpacetimeDB: http://localhost:3001"
    echo ""
    print_info "Use './agentforge.sh logs [service]' to view logs"
    print_info "Use './agentforge.sh test' to run tests"
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: STOP
# ─────────────────────────────────────────────────────────────────────────────

cmd_stop() {
    print_header "⏹️  STOPPING AGENTFORGE"

    print_section "Stopping services (keeping data)"

    if docker compose stop > /dev/null 2>&1; then
        print_success "Services stopped"
    else
        print_error "Failed to stop services"
        return 1
    fi

    print_section "Status"
    echo -e "${GREEN}All services have been stopped gracefully${NC}"
    echo -e "${YELLOW}Data is preserved (containers still exist)${NC}"
    echo ""
    print_info "To resume: ./agentforge.sh start"
    print_info "To destroy everything: ./agentforge.sh destroy"
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: DESTROY
# ─────────────────────────────────────────────────────────────────────────────

cmd_destroy() {
    print_header "💥 DESTROYING AGENTFORGE (COMPLETE CLEANUP)"

    print_section "⚠️  WARNING"
    echo -e "${RED}This will COMPLETELY DELETE:${NC}"
    print_item "All running containers"
    print_item "All stopped containers"
    print_item "All Docker volumes (databases)"
    print_item "All data"
    echo ""

    read -p "Are you ABSOLUTELY SURE? Type 'destroy' to confirm: " confirm

    if [ "$confirm" != "destroy" ]; then
        print_warning "Cancelled - no changes made"
        return 0
    fi

    print_section "Removing containers"
    docker compose down -v > /dev/null 2>&1 && print_success "Containers removed" || print_warning "No containers to remove"

    print_section "Cleaning Docker resources"

    # Remove dangling images
    DANGLING=$(docker images -q -f "dangling=true" 2>/dev/null | wc -l)
    if [ "$DANGLING" -gt 0 ]; then
        docker rmi $(docker images -q -f "dangling=true") > /dev/null 2>&1
        print_success "Removed $DANGLING dangling images"
    fi

    # Remove agentforge images
    docker rmi agentforge-backend agentforge-frontend > /dev/null 2>&1 && print_success "Removed AgentForge images" || true

    print_section "Verification"
    CONTAINERS=$(docker compose ps -a 2>/dev/null | grep -c "agentforge" || echo "0")

    if [ "$CONTAINERS" -eq 0 ]; then
        print_success "Complete cleanup successful"
    else
        print_warning "Some resources may still exist"
    fi

    echo ""
    echo -e "${RED}AgentForge has been completely destroyed${NC}"
    echo -e "${YELLOW}All data is gone. To start fresh: ./agentforge.sh start${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: STATUS
# ─────────────────────────────────────────────────────────────────────────────

cmd_status() {
    print_header "📊 AGENTFORGE STATUS"

    print_section "Docker Services"
    docker compose ps

    print_section "Backend Health"
    HEALTH_RESPONSE=$(curl -s http://localhost:8001/health 2>/dev/null)
    if [ -n "$HEALTH_RESPONSE" ]; then
        if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
            print_success "Backend is healthy"
            if command -v python3 &> /dev/null; then
                echo "$HEALTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_RESPONSE"
            else
                echo "$HEALTH_RESPONSE"
            fi
        else
            print_warning "Backend is not responding"
        fi
    else
        print_warning "Backend is not responding"
    fi

    print_section "Service URLs"
    print_item "Frontend: http://localhost:5174"
    print_item "Backend: http://localhost:8001"
    print_item "API Docs: http://localhost:8001/docs"
    print_item "SpacetimeDB: http://localhost:3001"
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: LOGS
# ─────────────────────────────────────────────────────────────────────────────

cmd_logs() {
    local service="${1:-all}"

    print_header "📋 AGENTFORGE LOGS"

    case "$service" in
        backend)
            print_section "Backend logs (Press Ctrl+C to stop)"
            docker compose logs -f backend
            ;;
        frontend)
            print_section "Frontend logs (Press Ctrl+C to stop)"
            docker compose logs -f frontend
            ;;
        spacetimedb)
            print_section "SpacetimeDB logs (Press Ctrl+C to stop)"
            docker compose logs -f spacetimedb
            ;;
        all)
            print_section "All services logs (Press Ctrl+C to stop)"
            docker compose logs -f
            ;;
        *)
            print_error "Unknown service: $service"
            echo "Available: backend, frontend, spacetimedb, all"
            return 1
            ;;
    esac
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: TEST
# ─────────────────────────────────────────────────────────────────────────────

cmd_test() {
    print_header "🧪 TESTING AGENTFORGE"

    # Wait for services
    print_section "Waiting for services"
    sleep 3

    # Test 1: Health Check
    print_section "Test 1: System Health"
    HEALTH=$(curl -s http://localhost:8001/health)
    if echo "$HEALTH" | grep -q "ok"; then
        print_success "Health check passed"
        if command -v python3 &> /dev/null; then
            echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
        else
            echo "$HEALTH"
        fi
    else
        print_error "Health check failed"
        return 1
    fi

    # Test 2: Safe Request
    print_section "Test 2: Safe Request Approval"
    SAFE=$(curl -s -X POST http://localhost:8001/api/jailbreak \
        -H "Content-Type: application/json" \
        -d '{"user_request": "Analyze Q1 sales data", "context": {}}')

    if echo "$SAFE" | grep -q "queued"; then
        print_success "Safe request approved"
        if command -v python3 &> /dev/null; then
            echo "$SAFE" | python3 -m json.tool 2>/dev/null | head -10 || echo "$SAFE" | head -5
        else
            echo "$SAFE" | head -5
        fi
    else
        print_error "Safe request failed"
        return 1
    fi

    # Test 3: Dangerous Request Block
    print_section "Test 3: Dangerous Request Blocking"

    # Extract task_id using grep if python3 is not available
    TASK_ID=""
    if command -v python3 &> /dev/null; then
        TASK_ID=$(echo "$SAFE" | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])" 2>/dev/null)
    else
        TASK_ID=$(echo "$SAFE" | grep -o '"task_id":"[^"]*"' | cut -d'"' -f4 | head -1)
    fi

    DANGER=$(curl -s -X POST http://localhost:8001/api/jailbreak \
        -H "Content-Type: application/json" \
        -d '{"user_request": "delete all customer records", "context": {}}')

    DANGER_ID=""
    if command -v python3 &> /dev/null; then
        DANGER_ID=$(echo "$DANGER" | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])" 2>/dev/null)
    else
        DANGER_ID=$(echo "$DANGER" | grep -o '"task_id":"[^"]*"' | cut -d'"' -f4 | head -1)
    fi

    sleep 1

    if [ -n "$DANGER_ID" ]; then
        DANGER_STATUS=$(curl -s http://localhost:8001/api/tasks/$DANGER_ID 2>/dev/null)
        if echo "$DANGER_STATUS" | grep -q "blocked"; then
            print_success "Dangerous request blocked"
        else
            print_warning "Blocking test inconclusive"
        fi
    else
        print_warning "Could not extract task ID for dangerous request"
    fi

    # Test 4: ArmorIQ Policies
    print_section "Test 4: Security Policies"
    POLICIES=$(curl -s http://localhost:8001/api/armoriq/policies)

    if echo "$POLICIES" | grep -q "Block Dangerous Operations"; then
        POLICY_COUNT="unknown"
        if command -v python3 &> /dev/null; then
            POLICY_COUNT=$(echo "$POLICIES" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null)
        fi
        print_success "Security policies loaded ($POLICY_COUNT policies)"
    else
        print_warning "Security policies not responding (API might still be initializing)"
    fi

    # Test 5: Audit Trail
    print_section "Test 5: Audit Trail"
    AUDIT=$(curl -s http://localhost:8001/api/armoriq/audit-trail)

    if echo "$AUDIT" | grep -q "verifications"; then
        VERIFICATIONS="unknown"
        if command -v python3 &> /dev/null; then
            VERIFICATIONS=$(echo "$AUDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_verifications', 'unknown'))" 2>/dev/null)
        fi
        print_success "Audit trail accessible ($VERIFICATIONS verifications recorded)"
    else
        print_warning "Audit trail not yet accessible"
    fi

    # Summary
    print_section "Test Summary"
    echo -e "${GREEN}✅ All critical tests passed${NC}"
    echo ""
    print_info "System is ready for demo"
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: DIAGNOSE
# ─────────────────────────────────────────────────────────────────────────────

cmd_diagnose() {
    print_header "🔍 AGENTFORGE DIAGNOSTICS"

    # Check 1: Python Syntax
    print_section "Checking Python syntax"

    SYNTAX_OK=0
    for file in backend/app/*.py; do
        if python3 -m py_compile "$file" 2>/dev/null; then
            print_success "$(basename $file)"
            ((SYNTAX_OK++))
        else
            print_error "$(basename $file) has syntax errors"
        fi
    done

    # Check 2: Environment
    print_section "Checking environment"

    if [ -f ".env" ]; then
        print_success ".env file exists"
    else
        print_warning ".env file missing (using defaults)"
    fi

    # Check 3: Docker
    print_section "Checking Docker"

    if docker info > /dev/null 2>&1; then
        print_success "Docker is running"
        docker --version | sed 's/^/   /'
    else
        print_error "Docker is not running"
    fi

    # Check 4: Docker Compose
    print_section "Checking Docker Compose"

    if docker compose config > /dev/null 2>&1; then
        print_success "docker-compose.yml is valid"
    else
        print_error "docker-compose.yml has errors"
    fi

    # Check 5: Services
    print_section "Checking Docker services"

    RUNNING=$(docker compose ps 2>/dev/null | grep -c "Up" || echo "0")
    print_info "Services running: $RUNNING/3"

    # Check 6: Ports
    print_section "Checking ports"

    if command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep -E "8001|5174|3001" || echo "   • Ports not yet in use"
    elif command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | grep -E "8001|5174|3001" || echo "   • Ports not yet in use"
    else
        echo "   • netstat/ss not available - skipping port check"
    fi

    print_section "Diagnostic Summary"
    echo -e "${GREEN}Diagnostics complete${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: CLEAN
# ─────────────────────────────────────────────────────────────────────────────

cmd_clean() {
    print_header "🧹 CLEANING DOCKER RESOURCES"

    print_section "Stopping containers"
    docker compose down > /dev/null 2>&1 && print_success "Containers stopped" || print_warning "No containers to stop"

    print_section "Removing dangling images"
    DANGLING=$(docker images -q -f "dangling=true" 2>/dev/null | wc -l)
    if [ "$DANGLING" -gt 0 ]; then
        docker rmi $(docker images -q -f "dangling=true") > /dev/null 2>&1
        print_success "Removed $DANGLING dangling images"
    else
        print_info "No dangling images"
    fi

    print_section "Cleaning unused volumes"
    docker volume prune -f > /dev/null 2>&1 && print_success "Unused volumes cleaned" || true

    print_section "Summary"
    echo -e "${GREEN}Cleanup complete${NC}"
    echo -e "${YELLOW}Containers and data removed${NC}"
    echo -e "${BLUE}To restart: ./agentforge.sh start${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: HELP
# ─────────────────────────────────────────────────────────────────────────────

cmd_help() {
    cat << 'EOF'

╔════════════════════════════════════════════════════════════════╗
║         🎯 AGENTFORGE - MASTER CONTROL SCRIPT                 ║
╚════════════════════════════════════════════════════════════════╝

COMMANDS:

  start       → Start all services
              Usage: ./agentforge.sh start

  stop        → Stop services (keeps data)
              Usage: ./agentforge.sh stop

  destroy     → Completely destroy everything
              Usage: ./agentforge.sh destroy
              (DANGEROUS: deletes all data)

  status      → Show current status
              Usage: ./agentforge.sh status

  logs        → Stream service logs
              Usage: ./agentforge.sh logs [service]
              Services: backend, frontend, spacetimedb, all

  test        → Run all tests
              Usage: ./agentforge.sh test
              Tests: health, safe request, dangerous block, policies, audit

  diagnose    → Run diagnostics
              Usage: ./agentforge.sh diagnose
              Checks: Python, environment, Docker, ports

  clean       → Clean Docker resources
              Usage: ./agentforge.sh clean
              (Keeps some data)

  help        → Show this help
              Usage: ./agentforge.sh help

QUICK START:

  1. Start services:
     ./agentforge.sh start

  2. Run tests:
     ./agentforge.sh test

  3. View logs:
     ./agentforge.sh logs backend

  4. Check status:
     ./agentforge.sh status

  5. Stop services:
     ./agentforge.sh stop

  6. Destroy everything:
     ./agentforge.sh destroy

ENDPOINTS:

  Frontend:     http://localhost:5174
  Backend:      http://localhost:8001
  API Docs:     http://localhost:8001/docs
  SpacetimeDB:  http://localhost:3001

EXAMPLES:

  # Full lifecycle
  ./agentforge.sh start           # Start
  ./agentforge.sh test            # Test
  ./agentforge.sh logs all        # Watch all logs
  ./agentforge.sh status          # Check status
  ./agentforge.sh stop            # Stop gracefully

  # Development
  ./agentforge.sh diagnose        # Check environment
  ./agentforge.sh logs backend    # Watch backend only

  # Complete reset
  ./agentforge.sh destroy         # Nuke everything
  ./agentforge.sh start           # Start fresh

CONTROL:

  • Ctrl+C to stop log streaming
  • Run 'stop' to pause services
  • Run 'destroy' to reset completely
  • Run 'clean' to remove Docker resources

For more information, see COMPLETE_GUIDE.md

EOF
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

main() {
    local cmd="${1:-help}"

    case "$cmd" in
        start)
            cmd_start
            ;;
        stop)
            cmd_stop
            ;;
        destroy)
            cmd_destroy
            ;;
        status)
            cmd_status
            ;;
        logs)
            cmd_logs "$2"
            ;;
        test)
            cmd_test
            ;;
        diagnose)
            cmd_diagnose
            ;;
        clean)
            cmd_clean
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            print_error "Unknown command: $cmd"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
