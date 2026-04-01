# AgentForge - AI Agent Orchestration Platform

## Project Overview

AgentForge is a multi-agent AI system that demonstrates intelligent task orchestration using Claude's API. It features real-time communication, distributed task execution, and interactive visualization of agent interactions.

**Key Features:**
- Multi-agent orchestration with ArmorIQ (intent verification & policy enforcement)
- Real-time synchronization via SpacetimeDB
- FastAPI backend with REST endpoints
- React frontend with Tailwind CSS
- Docker-based development environment
- Security & verification mechanisms

## Architecture

### Tech Stack
- **Backend**: Python 3.11+, FastAPI, ArmorIQ
- **Frontend**: TypeScript, React, Tailwind CSS, Vite
- **Database**: SpacetimeDB (real-time sync)
- **Infrastructure**: Docker, Docker Compose
- **Multi-Agent LLMs**: 
  - **Ollama (Mistral)** — Fast local analysis & validation
  - **Gemini 2.5 Flash** — Accurate cloud execution & reporting
- **Real-time Updates**: WebSocket synchronization

### System Flow
1. **User Submit** → FastAPI Backend receives POST /api/jailbreak
2. **ArmorIQ Processing** → Generates intent token, verifies tools against policy
3. **Agent Verification** → Checks plan validity, validates intent signature
4. **Multi-Agent Pipeline** (Real-time progress tracking):
   - **Step 1 (25%)**: Analyzer [Ollama - fast] — Breaks down request
   - **Step 2 (50%)**: Executor [Gemini Flash - accurate] — Executes actions
   - **Step 3 (75%)**: Validator [Ollama - fast] — Verifies results
   - **Step 4 (100%)**: Reporter [Gemini Flash - accurate] — Formats report
5. **Results** → SpacetimeDB persists output, Frontend auto-updates via WebSocket

## Project Structure

```
agentforge/
├── CLAUDE.md                 # This file
├── claude/settings.json      # Claude Code configuration
├── docker-compose.yml        # Multi-service orchestration
├── .env.example             # Environment variables template
│
├── backend/
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile           # Backend container
│   ├── app/
│   │   ├── main.py          # FastAPI application entry
│   │   ├── armoriq_integration.py  # ArmorIQ SDK integration
│   │   ├── agents.py        # Agent definitions
│   │   ├── orchestrator.py  # Task orchestration logic
│   │   └── spacetime.py     # SpacetimeDB integration
│
├── spacetimedb/
│   ├── Cargo.toml           # Rust dependencies
│   ├── tsconfig.json        # TypeScript config
│   ├── src/
│   │   ├── lib.ts           # SpacetimeDB schema & queries
│   │   └── migrations.sql   # Database schema
│
├── frontend/
│   ├── package.json         # Node dependencies
│   ├── Dockerfile           # Frontend container
│   ├── vite.config.ts       # Vite configuration
│   ├── tailwind.config.js   # Tailwind CSS config
│   └── src/
│       ├── App.tsx          # Main app component
│       ├── main.tsx         # React entry point
│       └── components/      # Reusable components
│           ├── AgentBoard.tsx
│           ├── TaskFlow.tsx
│           ├── Dashboard.tsx
│           └── DebugLog.tsx
│
└── scripts/
    ├── setup.sh             # Initial project setup
    └── demo.sh              # Run demo scenario
```

## Development Setup

### Prerequisites
- Docker & Docker Compose
- Python 3.11+ (for backend development)
- Node.js 18+ (for frontend development)
- Rust 1.70+ (for SpacetimeDB modules)
- **Ollama** running locally (for fast analysis & validation)
  - Install: https://ollama.ai/
  - Model: `mistral` (default, auto-pulled)
  - Verify: `curl http://localhost:11434/api/tags`
- **Gemini API Key** (for accurate execution & reporting)
  - Get key: https://ai.google.dev/
  - Model: `gemini-2.5-flash` (auto-selected)

### Quick Start

1. **Start Ollama (if not running):**
   ```bash
   ollama serve  # In a separate terminal
   ```

2. **Clone & prepare environment:**
   ```bash
   cd agentforge
   cp .env.example .env
   # Edit .env and add your Gemini API key
   # GEMINI_API_KEY=your-key-from-https://ai.google.dev/
   ```

3. **Start services:**
   ```bash
   docker-compose up --build
   ```
   Services will be available at:
   - Backend: http://localhost:8000
   - Frontend: http://localhost:5173
   - SpacetimeDB: http://localhost:3000

4. **Verify multi-agent setup:**
   ```bash
   curl http://localhost:8000/health
   # Should show: "armoriq": "enabled", agents with Ollama & Gemini providers
   ```

5. **Run demo:**
   ```bash
   bash scripts/demo.sh
   ```

## Development Phases

### Phase 1: Prerequisites (Complete)
- ✅ Install Docker Desktop
- ✅ Install Node.js & Python
- ✅ Install Rust (for SpacetimeDB)
- ✅ Install & run Ollama locally (https://ollama.ai/)
  - Verify: `curl http://localhost:11434/api/tags`
- ✅ Get Gemini API key from https://ai.google.dev/
- ✅ Verify all prerequisites configured in .env

### Phase 2: Project Setup (Day 1 - First 2 hours)
- Clone project files
- Create .env file with API keys
- Start Docker services
- Verify all services running on localhost

### Phase 3: Complete Core Code (Day 1-4 hours)
- Implement SpacetimeDB schema & reducers
- Build backend agent logic with ArmorIQ
- Test reducers & API endpoints
- Integration test between backend & database

### Phase 4: Demo Features (Day 2)
- Security demo: Show jailbreak blocks
- Real-time sync: Demonstrate WebSocket updates
- Multi-agent demo: All agents working in parallel
- Polish UI & animations

## Key Configuration Files

### claude/settings.json
Configures Claude Code editor behavior:
- MCP server connections (if needed)
- Hooks for automated tasks
- Default permissions & sandbox settings

### .env File (Required)
```
# Multi-Agent LLM Providers
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=mistral
GEMINI_API_KEY=your-api-key-from-https://ai.google.dev/

# Service URLs
BACKEND_URL=http://localhost:8000
SPACETIMEDB_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# Database
SPACETIMEDB_HOST=spacetimedb
SPACETIMEDB_PORT=3000

# Environment
NODE_ENV=development
DEBUG=true
LOG_LEVEL=INFO
```

**Provider Assignment:**
- Analyzer & Validator → Ollama (fast, runs locally)
- Executor & Reporter → Gemini Flash (accurate, cloud-based)

### docker-compose.yml
Defines three services:
- **backend**: FastAPI on port 8000
- **spacetimedb**: Real-time DB on port 3000
- **frontend**: Vite dev server on port 5173

## Multi-Agent Orchestration

### Agent Distribution & Provider Selection

| Agent | Provider | Role | Latency | Accuracy | Use Case |
|-------|----------|------|---------|----------|----------|
| **Analyzer** | Ollama (Mistral) | Decompose requests | ⚡ 1-3s | ⭐⭐⭐ Good | Quick intent understanding |
| **Executor** | Gemini 2.5 Flash | Execute actions | ⚡⚡ 2-5s | ⭐⭐⭐⭐⭐ Excellent | Critical operations |
| **Validator** | Ollama (Mistral) | Verify results | ⚡ 1-3s | ⭐⭐⭐ Good | Security checks |
| **Reporter** | Gemini 2.5 Flash | Format output | ⚡⚡ 2-5s | ⭐⭐⭐⭐⭐ Excellent | Report quality |

### Real-Time Progress Tracking

TaskFlow visualizes progress across all 4 agent steps with WebSocket broadcasting:

- **0-25%**: Analyzer (Ollama) — Fast request analysis
- **25-50%**: Executor (Gemini) — Accurate execution
- **50-75%**: Validator (Ollama) — Fast verification
- **75-100%**: Reporter (Gemini) — Accurate reporting

Each step broadcasts:
```json
{
  "type": "task_progress",
  "task_id": "task-123",
  "progress": 50,
  "step": "executor",
  "status": "processing"
}
```

### Cost Optimization

- **Ollama (Analyzer + Validator)**: Free, runs locally (50% of operations)
- **Gemini (Executor + Reporter)**: ~$0.075 per 1M input tokens (critical operations only)

**Total pipeline latency:** 6-16 seconds end-to-end

### Implementation Details

**backend/app/agents.py:**
- `LLMProvider` enum: OLLAMA, GEMINI
- `Agent.process()`: Routes to appropriate provider
- `_call_ollama()`: Local fast inference
- `_call_gemini()`: Accurate cloud inference

**backend/app/orchestrator.py:**
- `_broadcast_progress()`: Real-time progress updates (0-100%)
- `orchestrate()`: 4-step pipeline with synchronization
- Logs all agent actions to SpacetimeDB

**frontend/src/components/TaskFlow.tsx:**
- Progress mapping: 0%, 25%, 50%, 75%, 100%
- Live agent status visualization
- Step-by-step pipeline display

## API Endpoints

### POST /api/jailbreak
Submit a user request for processing.
- Request body: `{ "user_request": string, "context": object }`
- Response: `{ "task_id": string, "status": "queued" | "processing" | "blocked" | "complete" }`
- Real-time updates via SpacetimeDB subscription

### GET /api/tasks/{task_id}
Retrieve task details and results.
- Response includes: agents' responses, verification status, execution logs

### WS /ws/updates
WebSocket connection for real-time state updates.
- Frontend subscribes automatically on mount
- Broadcasts agent actions, security events, completion

## Security Considerations

1. **Request Validation**: All inputs validated before ArmorIQ processing
2. **Intent Verification**: ArmorIQ checks tool plan against JWT signature & policies
3. **Security Block**: Requests with security issues marked as BLOCKED
4. **Audit Logging**: All verifications and agent actions logged to SpacetimeDB for review

## Database Schema (SpacetimeDB)

Key tables:
- `tasks`: Task metadata (id, status, user_request, created_at)
- `agents`: Agent definitions (id, name, role, model, capabilities)
- `actions`: Agent actions (task_id, agent_id, action, timestamp)
- `security_events`: Security checks & blocks (task_id, event_type, details)
- `results`: Task results (task_id, status, output, verification_status)

## Workflow Checklist

### Setup Phase
- [x] Ollama running locally with mistral model
- [x] Gemini API key obtained and configured
- [x] Environment setup (.env created with GEMINI_API_KEY)
- [x] Docker services running (docker-compose up --build)

### Verification Phase
- [ ] Backend health check: `curl http://localhost:8000/health`
- [ ] Agent providers loaded: Analyzer & Validator on Ollama, Executor & Reporter on Gemini
- [ ] WebSocket connected: Check browser console on http://localhost:5173
- [ ] Task submission working: `curl -X POST http://localhost:8000/api/jailbreak -H "Content-Type: application/json" -d '{"user_request": "test", "context": {}}'`
- [ ] TaskFlow progress updates: Watch pipeline in real-time (0% → 25% → 50% → 75% → 100%)
- [ ] Multi-agent demo: All 4 agents executing with correct providers (1 Ollama, 2 Gemini, 3 Ollama, 4 Gemini)
- [ ] Security features working: Blocked requests show BLOCKED status

## Notes for Claude Code

### Multi-Agent Development

- **Agent provider selection**: Edit agents.py AGENTS dict to change provider (OLLAMA or GEMINI)
- **Progress tracking**: Orchestrator broadcasts task_progress events every step (0%, 25%, 50%, 75%, 100%)
- **TaskFlow updates**: Frontend receives progress via WebSocket and updates visualization in real-time
- **Provider fallback**: If Gemini API fails, the entire pipeline fails (no auto-fallback to Ollama)

### Troubleshooting

- **Gemini API errors**: Verify GEMINI_API_KEY is set: `echo $GEMINI_API_KEY`
- **Ollama connection errors**: Verify running: `curl http://localhost:11434/api/tags`
- **WebSocket not updating**: Check browser console & backend logs: `docker logs agentforge-backend`
- **Progress stuck at 0%**: Verify _broadcast_progress is called in orchestrator.orchestrate()

### Standard Development Flow

- **Backend modifications**: Update agents.py or orchestrator.py, then test with `curl http://localhost:8000/api/jailbreak`
- **Frontend changes**: Edit TaskFlow.tsx, Vite HMR reloads automatically
- **Database schema changes**: Update src/lib.ts in spacetimedb/ and re-run docker-compose
- **New dependencies**: Update requirements.txt (backend) or package.json (frontend)
- **Issues?**: Check docker logs: `docker-compose logs [service-name]`

## References

### Core Frameworks
- [FastAPI](https://fastapi.tiangolo.com)
- [React + TypeScript](https://react.dev)
- [SpacetimeDB](https://spacetimedb.com)
- [Docker Compose](https://docs.docker.com/compose)

### Multi-Agent LLMs
- [Ollama - Local LLMs](https://ollama.ai/)
- [Gemini 2.5 Flash API](https://ai.google.dev/api/python/google/generativeai/)

### Security & Verification
- [ArmorIQ Documentation](https://docs.armoriq.ai/)
- [WebSocket in FastAPI](https://fastapi.tiangolo.com/advanced/websockets/)
