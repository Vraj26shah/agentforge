# 🎯 AgentForge Master Control Script Guide

## Overview

There is **ONE master script** that controls everything:

```bash
./agentforge.sh [COMMAND]
```

This single script replaces 4 individual scripts:
- ❌ run.sh
- ❌ CHECK_WEBSITE.sh
- ❌ diagnose.sh
- ❌ start-and-verify.sh

All functionality is now consolidated into one simple command.

**✅ Works on:** Linux, macOS, Windows (WSL/Git Bash)

---

## System Requirements

### Required
- **Bash** (v4.0+) - The script is written for bash, not sh
- **Docker** - For running containerized services
- **Docker Compose** - For orchestrating multiple services
- **curl** - For API testing and health checks

### Optional (for better output)
- **Python 3** - For pretty-printing JSON responses (gracefully degrades without it)
- **netstat or ss** - For port checking (script handles missing tools)

### Installation by Platform

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose curl
# Bash usually pre-installed
```

**macOS:**
```bash
# Install via Homebrew
brew install docker docker-compose curl
# Bash pre-installed (or use: brew install bash)
```

**Windows (WSL2):**
```bash
# Inside WSL terminal
sudo apt-get update
sudo apt-get install -y docker.io docker-compose curl
# Then install Docker Desktop for Windows
```

**Windows (Git Bash):**
```bash
# Install Docker Desktop for Windows
# curl comes with Git Bash
```

---

## Running the Script

### Method 1: Direct Execution (Recommended)
```bash
# Make script executable (first time only)
chmod +x agentforge.sh

# Then run commands
./agentforge.sh start
./agentforge.sh test
./agentforge.sh logs backend
```

### Method 2: Explicit Bash
```bash
bash agentforge.sh start
bash agentforge.sh test
```

### Method 3: With bash -c
```bash
bash -c "cd /path/to/agentforge && ./agentforge.sh start"
```

### Method 4: In Docker
```bash
docker exec -it agentforge-backend bash -c "cd /app && bash agentforge.sh status"
```

**Note:** The script **requires bash** and will not work with `sh` or other shells. If you see errors about "not found" or "command not recognized", ensure you're using bash.

---

## Quick Reference

### Start Everything
```bash
./agentforge.sh start
```
✅ Builds and starts all services  
✅ Waits for initialization  
✅ Verifies services are running  
✅ Shows service URLs  

### Stop Services (Keep Data)
```bash
./agentforge.sh stop
```
✅ Gracefully stops all services  
✅ Preserves data and containers  
✅ Can restart with `start`  

### Destroy Everything (Nuclear Option)
```bash
./agentforge.sh destroy
```
⚠️ **DANGEROUS**: Deletes all containers, volumes, and data  
✅ Removes all traces of the project  
✅ Requires confirmation (type "destroy" to confirm)  

### Check Status
```bash
./agentforge.sh status
```
✅ Shows Docker service status  
✅ Shows backend health check  
✅ Displays all service URLs  

### View Logs
```bash
# Watch all services
./agentforge.sh logs all

# Watch specific service
./agentforge.sh logs backend
./agentforge.sh logs frontend
./agentforge.sh logs spacetimedb
```
✅ Stream logs in real-time  
✅ Press Ctrl+C to stop  

### Run Tests
```bash
./agentforge.sh test
```
✅ System health check  
✅ Safe request approval test  
✅ Dangerous request blocking test  
✅ Security policies test  
✅ Audit trail test  

### Run Diagnostics
```bash
./agentforge.sh diagnose
```
✅ Check Python syntax  
✅ Check environment configuration  
✅ Check Docker setup  
✅ Check docker-compose configuration  
✅ Check service ports  

### Clean Docker Resources
```bash
./agentforge.sh clean
```
✅ Stops containers  
✅ Removes dangling images  
✅ Cleans unused volumes  
✅ Keeps some data  

### Show Help
```bash
./agentforge.sh help
./agentforge.sh --help
./agentforge.sh -h
```

---

## Complete Workflow Examples

### Example 1: First Time Setup
```bash
# 1. Start services
./agentforge.sh start

# 2. Verify everything is running
./agentforge.sh status

# 3. Run tests
./agentforge.sh test

# 4. Watch logs
./agentforge.sh logs backend
```

### Example 2: Development Session
```bash
# Start
./agentforge.sh start

# Check health
./agentforge.sh status

# Watch backend logs
./agentforge.sh logs backend

# When done
./agentforge.sh stop
```

### Example 3: Debugging Issues
```bash
# Check what's wrong
./agentforge.sh diagnose

# View logs
./agentforge.sh logs all

# Run tests
./agentforge.sh test

# Reset if needed
./agentforge.sh clean
./agentforge.sh start
```

### Example 4: Complete Reset
```bash
# Destroy everything
./agentforge.sh destroy

# Start fresh
./agentforge.sh start

# Verify
./agentforge.sh test
```

### Example 5: Demo for Judges
```bash
# Start services
./agentforge.sh start

# Wait for services to be ready
sleep 5

# Run tests to verify everything works
./agentforge.sh test

# Open JUDGE_PRESENTATION.md and run demo commands
# Services will remain running during the demo

# After demo
./agentforge.sh stop
```

---

## Service URLs

Once started, access services at:

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5174 | Web dashboard |
| Backend API | http://localhost:8001 | REST API |
| API Docs | http://localhost:8001/docs | Interactive API docs |
| SpacetimeDB | http://localhost:3001 | Real-time database |

---

## Command Details

### START Command
**What it does:**
1. Checks Docker is running
2. Builds services (if needed)
3. Starts containers
4. Waits 5 seconds for initialization
5. Verifies all services are running
6. Tests endpoints
7. Shows service URLs

**When to use:**
- First time setup
- After stopping services
- After cleaning resources

**Exit codes:**
- 0 = Success
- 1 = Error (Docker not running, build failed, etc.)

---

### STOP Command
**What it does:**
1. Stops all running containers
2. Preserves volumes and data
3. Containers remain but are not running

**When to use:**
- Pause development temporarily
- Prepare for restart
- Keep data safe

**To restart:**
```bash
./agentforge.sh start
```

---

### DESTROY Command
**What it does:**
1. Requires confirmation ("destroy" must be typed)
2. Removes all containers
3. Removes all volumes (deletes databases)
4. Removes Docker images
5. Completely erases all traces

**When to use:**
- Complete reset needed
- Removing project entirely
- Cleaning up failed deployments

**WARNING:**
- This is irreversible
- All data will be deleted
- Requires confirmation to proceed

---

### STATUS Command
**What it does:**
1. Shows Docker compose status
2. Lists all containers and their status
3. Runs backend health check
4. Displays service URLs

**When to use:**
- Check if services are running
- Verify backend is healthy
- Get service connection info

---

### LOGS Command
**What it does:**
1. Streams real-time logs from specified service
2. Shows all output from that service

**Services:**
- `backend` - FastAPI application logs
- `frontend` - React development server logs
- `spacetimedb` - Database logs
- `all` - All service logs combined

**Usage:**
```bash
./agentforge.sh logs backend    # Backend only
./agentforge.sh logs all        # All services
```

**To stop:**
- Press Ctrl+C

---

### TEST Command
**What it does:**
1. Waits for services to be ready
2. Runs health check
3. Tests safe request approval
4. Tests dangerous request blocking
5. Verifies security policies
6. Checks audit trail

**When to use:**
- After starting services
- Verify everything is working
- Validate system before demo
- Check after code changes

**Tests included:**
- ✅ System health check
- ✅ Safe request flows through (status: queued)
- ✅ Dangerous request gets blocked (status: blocked)
- ✅ 5 security policies are active
- ✅ Audit trail records decisions

---

### DIAGNOSE Command
**What it does:**
1. Checks Python syntax in backend code
2. Verifies .env file exists
3. Checks Docker installation
4. Validates docker-compose.yml
5. Checks service ports
6. Shows Docker version

**When to use:**
- Troubleshooting startup issues
- Verifying environment setup
- Checking dependencies
- Before reporting bugs

---

### CLEAN Command
**What it does:**
1. Stops containers
2. Removes dangling images
3. Cleans unused volumes
4. Keeps some non-Docker data

**When to use:**
- Reduce disk space usage
- Clean up after failed builds
- Remove temporary resources
- Lighter than destroy

**Difference from destroy:**
- CLEAN: Keeps some data, lighter cleanup
- DESTROY: Complete removal, requires confirmation

---

## Troubleshooting

### Cross-Platform Issues

#### "bash: ./agentforge.sh: command not found" (Windows)
**Problem:** Script not executable or running in wrong shell
```bash
# Solution 1: Run explicitly with bash
bash agentforge.sh start

# Solution 2: Make executable
chmod +x agentforge.sh
./agentforge.sh start

# Solution 3: Check if using Git Bash (recommended for Windows)
# Install from: https://git-scm.com/download/win
```

#### "⚠️ This script requires bash" (Any platform)
**Problem:** Running with sh instead of bash
```bash
# Solution: Use bash explicitly
bash agentforge.sh [command]

# Or ensure bash is your default shell
chsh -s /bin/bash
```

#### "\r: command not found" (macOS/Linux from Windows)
**Problem:** File has Windows line endings (CRLF)
```bash
# Solution: Convert line endings
dos2unix agentforge.sh
# Or:
sed -i 's/\r$//' agentforge.sh
# Then:
chmod +x agentforge.sh
./agentforge.sh start
```

#### "Permission denied: ./agentforge.sh"
**Problem:** Script not executable
```bash
# Solution: Make executable
chmod +x agentforge.sh
./agentforge.sh start
```

### Docker Issues

#### "Docker daemon is not running"
**Linux:**
```bash
sudo systemctl start docker
sudo usermod -aG docker $USER  # Run docker without sudo
# You may need to log out and back in
```

**macOS:**
```bash
# Open Docker Desktop application
# Or: brew services start docker
```

**Windows:**
```bash
# Open Docker Desktop application
# Or restart WSL: wsl --shutdown
```

#### "docker-compose.yml has errors"
```bash
# Validate the file
docker compose config

# If that fails, check syntax in docker-compose.yml
# Then retry:
./agentforge.sh start
```

#### "Containers won't start"
```bash
# Step 1: Check logs
./agentforge.sh logs all

# Step 2: Check diagnostics
./agentforge.sh diagnose

# Step 3: Clean resources
./agentforge.sh clean

# Step 4: Start fresh
./agentforge.sh start
```

### Port Issues

#### "Port already in use"

**Linux:**
```bash
# Check what's using the port
lsof -i :8001
# Or:
netstat -tlnp | grep 8001

# Kill the process
kill -9 <PID>
```

**macOS:**
```bash
# Check port usage
lsof -i :8001

# Kill the process
kill -9 <PID>
```

**Windows (WSL):**
```bash
# Check port usage
netstat -ano | grep 8001

# Kill from Windows cmd (admin):
taskkill /PID <PID> /F

# Or restart WSL:
wsl --shutdown
```

**Alternative:** Use different ports
```bash
# Edit docker-compose.yml:
# Change port mappings (e.g., 8002:8000 instead of 8001:8000)
# Then restart:
./agentforge.sh stop
./agentforge.sh start
```

#### "Backend API not responding"
```bash
# Check status
./agentforge.sh status

# View backend logs
./agentforge.sh logs backend

# If that doesn't help, restart
./agentforge.sh stop
./agentforge.sh start

# Check if port is actually listening
curl -v http://localhost:8001/health
```

### Dependency Issues

#### "Command not found: curl"
```bash
# Linux
sudo apt-get install curl

# macOS
brew install curl

# Windows (should come with Git Bash)
# Or: choco install curl
```

#### "Command not found: python3"
**Note:** Python3 is optional - script works without it, just with less pretty output
```bash
# Linux
sudo apt-get install python3

# macOS
brew install python3

# Windows
# Download from: https://www.python.org/downloads/
```

#### "Command not found: docker compose"
```bash
# Your docker-compose is separate from docker
# Install docker-compose:
sudo pip install docker-compose

# Or use docker compose (newer):
docker compose version
```

### Network Issues

#### "Could not resolve hostname"
```bash
# Check internet connection
ping google.com

# For WSL, restart network
wsl --shutdown
wsl
```

#### "Connection refused: localhost:8001"
```bash
# Services may still be starting
sleep 10
./agentforge.sh status

# Or check with more detail
docker compose logs backend
```

### Output Issues

#### "Colors not displaying correctly"
**Problem:** Terminal doesn't support ANSI colors
```bash
# Script will still work - colors just won't show
# If you want colors, use a better terminal:
# - macOS: iTerm2, Alacritty
# - Linux: GNOME Terminal, Konsole, Alacritty
# - Windows: Windows Terminal, newer PowerShell
```

#### "JSON output is plain text"
**Problem:** Python3 not installed
```bash
# Install Python3 (optional):
# Linux: sudo apt-get install python3
# macOS: brew install python3
# Windows: https://www.python.org/downloads/

# Script works without it - just less pretty
```

---

## Script Design for All Contexts

This script is designed to work reliably in multiple contexts:

### 1. **Different Operating Systems**
- ✅ Linux (Ubuntu, Debian, CentOS, etc.)
- ✅ macOS (Intel and Apple Silicon)
- ✅ Windows (WSL2, Git Bash, MSYS2)
- ✅ Cloud Environments (GCP, AWS, Azure)

### 2. **Different Shells**
- ✅ Bash 4.0+ (required)
- ❌ sh, zsh, fish, ksh (not supported - script detects and warns)

### 3. **Different User Contexts**
- ✅ Local development (your machine)
- ✅ CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)
- ✅ Docker containers (running inside containers)
- ✅ SSH sessions (remote connections)
- ✅ Sudo context (with proper permissions)

### 4. **Degraded Environments**
- ✅ No Python3 (JSON output won't be pretty, but script works)
- ✅ No netstat/ss (port checking skipped gracefully)
- ✅ No git (project still works)
- ✅ Limited colors (uses fallback ASCII output)

### 5. **Error Recovery**
- ✅ Graceful error handling for missing dependencies
- ✅ Clear error messages with solutions
- ✅ No data loss on failure (uses safe operations)
- ✅ Can recover from partial failures

### Key Design Decisions

| Feature | Implementation | Benefit |
|---------|----------------|---------|
| **Bash explicit** | `#!/bin/bash` + validation | Works consistently across platforms |
| **Relative paths** | `SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")"`  | Works from any directory |
| **Error handling** | `set -o pipefail` + exit codes | Fails fast and clearly |
| **Color support** | Conditional ANSI codes | Works in limited environments |
| **Dependency checks** | `command -v` checks | Clear error messages |
| **Graceful degradation** | Optional Python/netstat | Works without extras |
| **Platform detection** | Tests for available commands | Adapts to environment |

---

## Best Practices

### Before Demo
```bash
# 1. Start services
./agentforge.sh start

# 2. Wait for full initialization
sleep 10

# 3. Run tests to verify
./agentforge.sh test

# 4. Check status
./agentforge.sh status

# Now ready for demo
```

### During Development
```bash
# Keep one terminal for logs
./agentforge.sh logs backend

# Use another terminal for commands
./agentforge.sh start
./agentforge.sh test
./agentforge.sh status
```

### After Session
```bash
# Gracefully stop (keeps data)
./agentforge.sh stop

# Or clean up (removes temp data)
./agentforge.sh clean
```

### Complete Reset
```bash
# Only when necessary
./agentforge.sh destroy
./agentforge.sh start
```

---

## Summary

**One script. Complete control.**

| What | Command |
|------|---------|
| Start | `./agentforge.sh start` |
| Stop | `./agentforge.sh stop` |
| Destroy | `./agentforge.sh destroy` |
| Status | `./agentforge.sh status` |
| Logs | `./agentforge.sh logs [service]` |
| Test | `./agentforge.sh test` |
| Diagnose | `./agentforge.sh diagnose` |
| Clean | `./agentforge.sh clean` |
| Help | `./agentforge.sh help` |

---

## File Structure

**Before consolidation (4 scripts):**
- ❌ run.sh
- ❌ CHECK_WEBSITE.sh
- ❌ diagnose.sh
- ❌ start-and-verify.sh

**After consolidation (1 script):**
- ✅ agentforge.sh (23K, all-in-one)

**Result:**
- ✅ Simpler
- ✅ Easier to maintain
- ✅ No confusion about which script to use
- ✅ All commands in one place
- ✅ Better help system

---

## Tips

1. **Always start with**: `./agentforge.sh start`
2. **Always verify with**: `./agentforge.sh test`
3. **For logs, use**: `./agentforge.sh logs all`
4. **For issues, try**: `./agentforge.sh diagnose`
5. **For complete reset**: `./agentforge.sh destroy` then `start`

---

## Everything in One Place ✨

This file (`SCRIPT_GUIDE.md`) contains **ALL** the information you need:

| Section | Content |
|---------|---------|
| **System Requirements** | What you need to install |
| **Running the Script** | How to run in different contexts |
| **Quick Reference** | All commands at a glance |
| **Complete Workflow Examples** | Real-world scenarios |
| **Command Details** | What each command does |
| **Service URLs** | Where to access services |
| **Troubleshooting** | Cross-platform solutions |
| **Script Design** | How it works reliably everywhere |
| **Best Practices** | Do's and don'ts |

### No Need to Read Other Documents For:
- ✅ How to start/stop services
- ✅ How to run tests
- ✅ How to view logs
- ✅ How to fix common issues
- ✅ Cross-platform compatibility
- ✅ Dependency requirements

### You Might Also Want:
- 📖 **COMPLETE_GUIDE.md** - In-depth architecture & advanced topics
- 🎯 **JUDGE_PRESENTATION.md** - Demo scenarios & presentation flow

---

## Quick Help

**Forgot the command?**
```bash
./agentforge.sh help
```

**Something not working?**
```bash
# 1. Check what's wrong
./agentforge.sh diagnose

# 2. Look for your error in the "Troubleshooting" section above
# 3. Or search this file for the error message
```

**Running on a specific platform?**
1. Find your OS in the "System Requirements" section
2. Follow the "Troubleshooting" section for your platform
3. Try the solution steps

---

**Status**: ✅ Ready to use on all platforms and contexts

---

**Questions?** Run `./agentforge.sh help` or check this guide
