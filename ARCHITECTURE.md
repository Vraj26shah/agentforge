# 🏗️ AgentForge Architecture

Complete technical architecture documentation for the AgentForge AI agent orchestration platform.

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Details](#component-details)
4. [Data Flow](#data-flow)
5. [Security Architecture](#security-architecture)
6. [Deployment Architecture](#deployment-architecture)

---

## System Overview

AgentForge is a multi-agent AI orchestration platform that enables secure, collaborative code editing and task execution through a 4-agent pipeline with real-time security enforcement.

### Key Components
- **Frontend**: React + TypeScript SPA with real-time WebSocket updates
- **Backend**: FastAPI Python server with async processing
- **Database**: SpacetimeDB for real-time data synchronization
- **LLM**: Dual-provider system (Ollama local + Gemini cloud)
- **Security**: ArmorIQ intent verification and RBAC enforcement

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                            │
│                                                                         │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐        │
│  │  Dashboard   │  Task Flow   │  Codespace   │  Agent Board │        │
│  │  (Submit)    │  (Progress)  │  (Chat+Edit) │  (Status)    │        │
│  └──────────────┴──────────────┴──────────────┴──────────────┘        │
│                                                                         │
│  React 18 + TypeScript + Tailwind CSS + WebSocket                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTP REST + WebSocket
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                         API GATEWAY LAYER                               │
│                                                                         │
│  FastAPI + Uvicorn (ASGI)                                              │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Endpoints: /api/jailbreak, /api/tasks, /api/codespace,         │ │
│  │             /api/agents, /api/armoriq, /ws/updates               │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                      SECURITY ENFORCEMENT LAYER                         │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  ArmorIQ Intent Verification                                     │ │
│  │  • Intent Token Generation (JWT)                                 │ │
│  │  • Token Signature Verification                                  │ │
│  │  • Intent Classification (Analyzer AI)                           │ │
│  │  • RBAC Policy Check (Role-based)                                │ │
│  │  • Pre-flight Tool Verification                                  │ │
│  │  • Audit Trail Logging                                           │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Policy Matrix: junior_engineer → senior_developer → tech_lead → admin │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  4-Agent Pipeline (Sequential Execution)                         │ │
│  │                                                                  │ │
│  │  1. Analyzer (Ollama - Fast)                                     │ │
│  │     • Decomposes user request into sub-tasks                     │ │
│  │     • Analyzes file context and requirements                     │ │
│  │     • Outputs numbered action list                               │ │
│  │                                                                  │ │
│  │  2. Executor (Gemini - Accurate)                                 │ │
│  │     • Executes code changes or answers questions                 │ │
│  │     • Applies modifications to files                             │ │
│  │     • Generates complete updated content                         │ │
│  │                                                                  │ │
│  │  3. Validator (Ollama - Fast)                                    │ │
│  │     • Validates executor output against request                  │ │
│  │     • Checks for bugs, omissions, compliance                     │ │
│  │     • Returns PASS/FAIL with reasoning                           │ │
│  │                                                                  │ │
│  │  4. Reporter (Gemini - Accurate)                                 │ │
│  │     • Formats final output for user consumption                  │ │
│  │     • Generates diff for code changes                            │ │
│  │     • Creates markdown-formatted responses                       │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Progress Tracking: 0% → 25% → 50% → 75% → 100%                        │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼──────────┐
│  LLM LAYER     │  │  DATA LAYER     │  │  FILE LAYER      │
│                │  │                 │  │                  │
│  Ollama        │  │  SpacetimeDB    │  │  Codespace       │
│  • qwen2:0.5b  │  │  • Tasks        │  │  • File Tree     │
│  • Local       │  │  • Actions      │  │  • Read/Write    │
│  • Fast        │  │  • Results      │  │  • Diff Gen      │
│                │  │  • Events       │  │  • Safe Paths    │
│  Gemini        │  │  • Audit Trail  │  │                  │
│  • 2.5-flash   │  │                 │  │  Max: 500KB      │
│  • Cloud       │  │  Real-time      │  │  Ignored: node_  │
│  • Accurate    │  │  Pub/Sub        │  │  modules, .git   │
│                │  │                 │  │                  │
│  Fallback:     │  │  HTTP API       │  │  Traversal       │
│  Gemini→Ollama │  │  Port: 3001     │  │  Protection      │
└────────────────┘  └─────────────────┘  └──────────────────┘
```

---

## Component Details

### 1. Frontend (React SPA)

**Technology Stack**
- React 18 with TypeScript
- Vite (build tool, HMR)
- Tailwind CSS (styling)
- WebSocket (real-time)

**Key Components**

#### Dashboard
- Task submission form with role selector
- Task history with status cards
- RBAC judgment display
- System configuration panel

#### Codespace (AI Code Assistant)
- **Left Panel**: File explorer with tree view
- **Center Panel**: Code editor with line numbers, diff viewer
- **Right Panel**: AI chat with context awareness

**Features**:
- File upload (import local files)
- Create new files
- Open by path
- Save with Ctrl+S
- Diff viewer (accept/reject/refine)
- Chat history per file
- Real-time suggestions

#### Task Flow
- 6-step pipeline visualization
- Progress bars (0-100%)
- Agent status indicators
- Real-time updates

#### Agent Board
- 4 agent status cards
- Execution count
- LLM provider info
- Current task tracking

**State Management**
- localStorage for persistence
- Session ID tracking
- WebSocket for real-time sync

---

### 2. Backend (FastAPI)

**Technology Stack**
- Python 3.11
- FastAPI (async web framework)
- Uvicorn (ASGI server)
- httpx (async HTTP client)
- python-jose (JWT)

**Core Modules**

#### main.py
- FastAPI app initialization
- CORS middleware
- WebSocket endpoint
- Task submission endpoints
- Codespace endpoints
- ArmorIQ endpoints

**Key Endpoints**:
```python
POST /api/jailbreak          # Submit task
GET  /api/tasks/{id}         # Get task details
GET  /api/agents             # Agent status
POST /api/codespace/suggest  # AI code suggestion
POST /api/codespace/apply    # Write file
WS   /ws/updates             # Real-time updates
```

#### agents.py
- Agent class definition
- LLM provider abstraction
- Ollama integration
- Gemini integration
- Fallback logic
- Intent classification

**Agent Configuration**:
```python
AGENTS = {
    "analyzer": Agent(role=ANALYZER, provider=OLLAMA),
    "executor": Agent(role=EXECUTOR, provider=GEMINI),
    "validator": Agent(role=VALIDATOR, provider=OLLAMA),
    "reporter": Agent(role=REPORTER, provider=GEMINI),
}
```

#### orchestrator.py
- 4-agent pipeline coordinator
- Progress tracking
- WebSocket broadcasting
- Error handling
- Non-fatal step failures

**Pipeline Flow**:
1. Intent classification (pre-flight)
2. RBAC check (pre-flight)
3. Analyzer → Executor → Validator → Reporter
4. Progress broadcast at each step
5. Final result aggregation

#### codespace.py
- File tree generation
- File read/write operations
- Path traversal protection
- Diff computation
- Code fence stripping

**Safety Features**:
- Path validation (no `../` traversal)
- File size limits (500KB max)
- Ignored directories (node_modules, .git)
- Safe file extensions only

#### armoriq_integration.py
- Intent token generation
- Token verification
- RBAC policy enforcement
- Audit trail logging
- Security event tracking

---

### 3. Database (SpacetimeDB)

**Schema**

```rust
// Tasks table
#[spacetimedb(table)]
pub struct Task {
    #[primarykey]
    pub id: String,
    pub user_request: String,
    pub status: String,
    pub progress: u32,
    pub user_id: String,
    pub role: String,
    pub created_at: String,
}

// Actions table
#[spacetimedb(table)]
pub struct Action {
    #[primarykey]
    pub id: String,
    pub task_id: String,
    pub agent_id: String,
    pub action_type: String,
    pub output: String,
}

// Security events table
#[spacetimedb(table)]
pub struct SecurityEvent {
    #[primarykey]
    pub id: String,
    pub task_id: String,
    pub event_type: String,
    pub severity: String,
    pub details: String,
}
```

**Features**
- Real-time pub/sub
- HTTP API (port 3001)
- Automatic persistence
- Query reducers

---

## Data Flow

### Task Submission Flow

```
User submits request
  ↓
POST /api/jailbreak
  ↓
ArmorIQ: Generate intent token (JWT)
  ↓
ArmorIQ: Verify token signature
  ↓
If invalid → Return blocked status
  ↓
If valid → Queue background task
  ↓
Background: classify_and_judge()
  ↓
Intent classification (Analyzer AI)
  ↓
RBAC check (role vs intent category)
  ↓
If blocked → Return immediately with judgment
  ↓
If allowed → Run 4-agent pipeline
  ↓
Each step: Broadcast agent_update + task_progress
  ↓
Final: Broadcast task_update with report
```

### Codespace Chat Flow

```
User types message in chat
  ↓
POST /api/codespace/suggest {file_path, request, role}
  ↓
Backend: ArmorIQ token generation + RBAC check
  ↓
If blocked: Return immediately with judgment
  ↓
If allowed: Queue 4-agent pipeline
  ↓
WebSocket broadcasts task_progress (0% → 100%)
  ↓
WebSocket broadcasts task_update with suggested_content + diff_lines
  ↓
Frontend: Detect completion, show DiffViewer
  ↓
User clicks "Accept & Apply"
  ↓
POST /api/codespace/apply {path, content}
  ↓
File written to codebase, AppliedBanner shown
```

### WebSocket Real-Time Updates

```
Client connects: ws://backend/ws/updates?session_id={id}
  ↓
Server sends: existing_tasks snapshot
  ↓
Server sends: agent statuses
  ↓
During task execution:
  - task_progress (0-100%)
  - agent_update (idle/working/error)
  - log messages
  ↓
On completion:
  - task_update (final status, report, diff)
```

---

## Security Architecture

### ArmorIQ Intent Verification

**1. Intent Token Generation**
```python
intent_token = {
    "intent_hash": sha256(user_request + tool_plan),
    "tool_plan": ["analyze", "execute", "verify", "report"],
    "user_id": "user-123",
    "agent_id": "agentforge-agent",
    "issued_at": datetime.utcnow(),
    "expires_at": datetime.utcnow() + timedelta(seconds=600),
}
token = jwt.encode(intent_token, SECRET_KEY, algorithm="HS256")
```

**2. Token Verification**
- Signature validation (HMAC-SHA256)
- Expiration check (600s default)
- Intent hash verification

**3. RBAC Policy Matrix**

| Role | read | write | code_change | delete_file | deploy | admin_action |
|------|------|-------|-------------|-------------|--------|--------------|
| junior_engineer | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| senior_developer | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| tech_lead | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**4. Pre-flight Tool Verification**
- Each tool in plan verified before execution
- Fail-closed: any verification failure blocks entire pipeline
- Audit trail logged for all decisions

---

## Deployment Architecture

### Development (Local)
```
docker-compose up
  ↓
Services:
  - Frontend: localhost:5174
  - Backend: localhost:8001 (host network)
  - SpacetimeDB: localhost:3001
  - Ollama: localhost:11434 (host machine)
```

### Production (Cloud)

**Option 1: Render (Free Tier)**
```
GitHub repo → Render Blueprint (render.yaml)
  ↓
Services:
  - Frontend: Static site (auto-deploy)
  - Backend: Web service (Docker)
  - SpacetimeDB: Web service (Docker)
  ↓
Auto SSL, custom domain, auto-deploy on push
```

**Option 2: Railway**
```
railway up
  ↓
Services:
  - Backend: Dockerfile.prod
  - Frontend: npm run build
  - SpacetimeDB: Docker image
  ↓
Auto-scaling, built-in monitoring
```

**Option 3: Fly.io**
```
flyctl deploy
  ↓
Global edge deployment
  - 3 VMs (free tier)
  - Auto-scaling
  - Low latency
```

### Scaling Strategy

**Horizontal Scaling**
```bash
docker-compose up --scale backend=3
```

**Vertical Scaling**
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

---

## Performance Characteristics

### Latency
- API response: <100ms
- WebSocket latency: <50ms
- File read: <150ms
- Task submission: <100ms (queued)

### Pipeline Execution Time
- With Gemini: ~2 minutes
- With Ollama fallback: ~9 minutes
- Intent classification: ~20s
- Analyzer: ~3.5 minutes (large files)
- Executor: ~3 minutes
- Validator: ~10s
- Reporter: ~2.5 minutes

### Throughput
- Concurrent tasks: 10+ (limited by LLM API)
- WebSocket connections: 100+ per instance
- File operations: 1000+ req/s

---

## Error Handling

### Non-Fatal Failures
- Analyzer failure → Continue with default decomposition
- Executor failure → Continue with placeholder output
- Validator failure → Continue with "PASS (skipped)"
- Reporter failure → Fall back to executor output

### Fatal Failures
- ArmorIQ token verification failure → Block immediately
- RBAC policy denial → Block immediately
- SpacetimeDB connection failure → Graceful degradation

### Fallback Chain
```
Gemini 429 → Retry (5s, 20s) → Try next model → Ollama fallback
Ollama timeout → Truncate prompt → Retry → Gemini fallback
```

---

## Monitoring & Observability

### Logs
```bash
docker logs -f agentforge_backend_1
```

### Metrics
- Task completion rate
- Agent execution count
- Security events (blocked/allowed)
- WebSocket connections
- API response times

### Health Checks
```bash
curl http://localhost:8001/health
```

Returns:
```json
{
  "status": "ok",
  "service": "agentforge-backend",
  "version": "0.1.0",
  "armoriq": "enabled",
  "spacetimedb": "connected"
}
```

---

## Future Enhancements

1. **Multi-tenancy**: Workspace isolation per user
2. **Plugin System**: Custom agent types
3. **Streaming Responses**: Real-time token streaming
4. **Caching**: File content and analysis caching
5. **Rate Limiting**: Per-user request throttling
6. **Metrics Dashboard**: Grafana + Prometheus
7. **CI/CD Integration**: GitHub Actions, GitLab CI
8. **Mobile App**: React Native client

---

**Last Updated**: 2026-04-18  
**Version**: 1.0.0  
**Maintainer**: AgentForge Team
