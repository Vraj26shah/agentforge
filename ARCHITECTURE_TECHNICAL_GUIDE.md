# AgentForge: Technical Architecture Deep Dive

**For developers and architects who want to understand the system internals**

**Last Updated:** April 2026 | **Version:** 2.0.0 | **Status:** Production Ready ✓

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [RBAC & Intent Classification System](#rbac--intent-classification-system)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Component Interactions](#component-interactions)
5. [Orchestration Logic](#orchestration-logic)
6. [Frontend Architecture](#frontend-architecture)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Performance Optimization](#performance-optimization)
9. [Scalability Considerations](#scalability-considerations)
10. [Database Schema](#database-schema)
11. [API Reference](#api-reference)
12. [Deployment Architecture](#deployment-architecture)

---

## System Architecture

### Layered Architecture Model

```
┌──────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                      │
│  ┌────────────┬─────────────┬───────────┬──────────┬──────┐  │
│  │ Dashboard  │  Task Flow  │AgentBoard │Workflow  │ Logs │  │
│  │ + Profile  │  (React)    │ (React)   │(React)   │(React│  │
│  │ Switcher   │             │           │          │      │  │
│  └────────────┴─────────────┴───────────┴──────────┴──────┘  │
└────────────────────────┬─────────────────────────────────────┘
                         │ WebSocket (Real-time)
                         │ HTTP REST (Async)
┌────────────────────────▼─────────────────────────────────────┐
│                     APPLICATION LAYER                        │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  FastAPI Server (async/await)                         │   │
│  │  ┌──────────────┐  ┌──────────────────────────────┐  │   │
│  │  │ Request      │  │ WebSocket Manager             │  │   │
│  │  │ Handler      │  │ (Broadcasting to all clients) │  │   │
│  │  └──────────────┘  └──────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────┘   │
└────────────────────────┬─────────────────────────────────────┘
                         │
        ┌────────────────┼─────────────────┐
        │                │                 │
┌───────▼───────┐ ┌──────▼───────┐ ┌──────▼──────────┐
│  RBAC & INTENT│ │ORCHESTRATION │ │   EXECUTION     │
│  LAYER (NEW)  │ │   LAYER      │ │    LAYER        │
├───────────────┤ ├──────────────┤ ├─────────────────┤
│ IntentClassify│ │ TaskOrchest- │ │ Agent Pool      │
│ (Analyzer AI) │ │ rator        │ │                 │
│               │ │              │ │ • Analyzer      │
│ ArmorIQ RBAC  │ │ • Pipeline   │ │   (Ollama)      │
│               │ │ • Step Flow  │ │ • Executor      │
│ • UserRole    │ │ • Error Mgmt │ │   (Gemini)      │
│ • IntentCat.  │ │ • Progress   │ │ • Validator     │
│ • PolicyMatrix│ │ • Broadcast  │ │   (Ollama)      │
│ • RBACJudgment│ │              │ │ • Reporter      │
│               │ │              │ │   (Gemini)      │
└───────────────┘ └──────────────┘ └─────────────────┘
        │                │                 │
        └────────────────┼─────────────────┘
                         │
        ┌────────────────┼─────────────────┐
        │                │                 │
┌───────▼───────┐ ┌──────▼───────┐ ┌──────▼──────────┐
│PROVIDER LAYER │ │  DATABASE    │ │    LOGGING      │
├───────────────┤ │    LAYER     │ ├─────────────────┤
│ Ollama API    │ │              │ │ SpacetimeDB     │
│ (local fast)  │ │ SpacetimeDB  │ │ Event Stream    │
│               │ │ (real-time)  │ │ Audit Trail     │
│ Gemini 2.5    │ │              │ │ RBAC Log        │
│ Flash (cloud) │ │              │ │                 │
└───────────────┘ └──────────────┘ └─────────────────┘
```

---

## RBAC & Intent Classification System

This is the core new feature added in v2.0. Every user request passes through a two-stage gate before any agent runs.

### Stage 1 — Intent Classification (Analyzer AI / Ollama)

The Analyzer agent uses `classify_intent()` to call Ollama with a structured prompt and returns:

```json
{
  "category": "delete_file",
  "risk_level": "high",
  "description": "User wants to remove the config.js file from the project.",
  "reasoning": "Contains 'delete' keyword targeting a file path."
}
```

**Intent Categories:**

| Category | Description | Example Request |
|---|---|---|
| `read` | Viewing, listing, querying | "Show me the logs" |
| `write` | Creating or editing files/data | "Update the README" |
| `code_change` | Modifying source code | "Refactor the auth module" |
| `delete_file` | Removing files/directories | "Delete the old config" |
| `delete_database` | Dropping tables, wiping DB | "Drop the staging database" |
| `deploy` | Pushing to production | "Deploy the latest build" |
| `system_command` | Shell/system-level operations | "Run the migration script" |
| `admin_action` | User management, permissions | "Grant admin access to user X" |

**Risk Levels:** `low` → `medium` → `high` → `critical`

### Stage 2 — RBAC Policy Check (ArmorIQ)

ArmorIQ's `check_rbac(role, intent_classification)` evaluates the intent against the role policy matrix and returns an `RBACJudgment`.

### Role Permission Matrix

| Intent | junior_engineer | senior_developer | tech_lead | admin |
|---|---|---|---|---|
| `read` | ✅ allow | ✅ allow | ✅ allow | ✅ allow |
| `write` | ✅ allow | ✅ allow | ✅ allow | ✅ allow |
| `code_change` | ✅ allow | ✅ allow | ✅ allow | ✅ allow |
| `delete_file` | 🚫 block | ✅ allow | ✅ allow | ✅ allow |
| `delete_database` | 🚫 block | ⏳ approval | ⏳ approval | ✅ allow |
| `deploy` | 🚫 block | ✅ allow | ✅ allow | ✅ allow |
| `system_command` | 🚫 block | ⏳ approval | ✅ allow | ✅ allow |
| `admin_action` | 🚫 block | 🚫 block | ⏳ approval | ✅ allow |

**Legend:** ✅ = Allowed | 🚫 = Blocked | ⏳ = Requires approval from higher role

### Approval Chains

| Role | Action | Must Escalate To |
|---|---|---|
| senior_developer | delete_database | Tech Lead or Admin |
| senior_developer | system_command | Tech Lead |
| tech_lead | delete_database | Admin |
| tech_lead | admin_action | Admin |
| junior_engineer | delete_file | Senior Developer |
| junior_engineer | deploy | Senior Developer |

### RBACJudgment Output

Every request returns a full judgment object:

```json
{
  "role": "junior_engineer",
  "intent_category": "delete_file",
  "risk_level": "high",
  "intent_description": "User wants to delete the config.js file.",
  "intent_reasoning": "Request contains 'delete' targeting a file.",
  "policy_action": "block",
  "judgment_reason": "🚫 BLOCKED — Junior engineers cannot delete files. Escalate to a Senior Developer.",
  "requires_approval_from": null,
  "allowed": false,
  "timestamp": "2026-04-17T10:30:45Z"
}
```

### Code Locations

| Component | File | Key Function |
|---|---|---|
| UserRole, IntentCategory enums | `backend/app/armoriq_integration.py` | Lines 20–90 |
| RBAC policy matrix | `backend/app/armoriq_integration.py` | `RBAC_MATRIX` dict |
| RBACJudgment dataclass | `backend/app/armoriq_integration.py` | `RBACJudgment` |
| RBAC evaluation | `backend/app/armoriq_integration.py` | `ArmorIQClient.check_rbac()` |
| Intent classification (AI) | `backend/app/agents.py` | `Agent.classify_intent()` |
| Pre-pipeline judgment step | `backend/app/orchestrator.py` | `TaskOrchestrator.classify_and_judge()` |
| Profile switcher UI | `frontend/src/App.tsx` | `ProfileSwitcher` component |
| Judgment display UI | `frontend/src/components/Dashboard.tsx` | `JudgmentPanel` component |
| Final report display UI | `frontend/src/components/Dashboard.tsx` | `AgentReport` component |

---

## Data Flow Diagrams

### 1. Full Request Flow (v2.0 — includes RBAC)

```
Frontend (Dashboard)
     │
     │ POST /api/jailbreak
     │ {
     │   "user_request": "Delete the config.js file",
     │   "context": {...},
     │   "user_id": "session-abc-123",
     │   "role": "junior_engineer"          ← NEW in v2.0
     │ }
     ▼
┌──────────────────────────────────────┐
│ FastAPI: submit_jailbreak()          │
├──────────────────────────────────────┤
│ 1. Generate task_id                  │
│ 2. identify_tools_from_request()     │
│ 3. Store role in task record         │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ ArmorIQ: generate_intent_token()     │
├──────────────────────────────────────┤
│ 1. Hash intent + tool plan           │
│ 2. Sign JWT (HMAC-SHA256)            │
│ 3. Set 600s expiry                   │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ ArmorIQ: verify_intent_token()       │
├──────────────────────────────────────┤
│ 1. Verify signature                  │
│ 2. Check expiry                      │
└──────────────────────────────────────┘
     │
     ├─ Invalid? ──► BLOCKED (token error) → return immediately
     │
    Valid
     │
     ▼
  Queue task → Background: process_task_with_armoriq()

     ─── BACKGROUND ───────────────────────────────────────────
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│ PRE-PIPELINE: classify_and_judge()    ← NEW in v2.0      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Step A: Analyzer AI (Ollama) → classify_intent()        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Prompt Ollama with structured intent classifier    │  │
│  │ Returns JSON: {category, risk_level, description,  │  │
│  │                reasoning}                          │  │
│  │ Fallback: keyword matching if Ollama JSON fails    │  │
│  └────────────────────────────────────────────────────┘  │
│                          │                               │
│                          ▼                               │
│  Step B: ArmorIQ → check_rbac(role, intent)              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Lookup RBAC_MATRIX[role][intent_category]          │  │
│  │ Returns RBACJudgment:                              │  │
│  │   allowed = True/False                             │  │
│  │   policy_action = allow/block/require_approval     │  │
│  │   judgment_reason = full explanation               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
     │
     ├─ allowed=False? ──► BLOCKED immediately
     │                      Broadcast judgment via WebSocket
     │                      Log rbac_judgment security event
     │                      Pipeline does NOT run
     │
    allowed=True
     │
     ▼
┌──────────────────────────────────────┐
│ ArmorIQ Pre-flight: verify_step()    │
│ (JWT tool-plan check per tool)       │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ 4-AGENT ORCHESTRATION PIPELINE       │
│ Analyzer → Executor → Validator      │
│ → Reporter                           │
└──────────────────────────────────────┘
     │
     ▼
task_update broadcast includes:
  { judgment: {...}, report: "...", status: "completed" }
```

### 2. Judgment Fast-Fail (Blocked Case)

```
classify_and_judge() result: allowed=False
     │
     ├─ Broadcast log: "🚫 BLOCKED — [reason]"
     ├─ Log to SpacetimeDB: security_event {type: "rbac_judgment"}
     ├─ Return from orchestrate() immediately:
     │    {
     │      status: "blocked",
     │      judgment: { ... },
     │      blocked_reason: "🚫 BLOCKED — Junior engineers cannot delete files...",
     │      report: "🚫 BLOCKED — ..."
     │    }
     │
     ▼
Frontend receives task_update:
  task.status = "blocked"
  task.judgment = { intent_category, risk_level, judgment_reason, ... }
  → JudgmentPanel renders full breakdown in TaskCard
```

### 3. Orchestration Pipeline Flow (Post-RBAC)

```
process_task_with_armoriq() — after RBAC approved
     │
     ├─ Mark task: "processing"
     ├─ Broadcast: task_update (progress: 5%)
     │
     ▼
┌─────────────────────────────────────┐
│ ARMORIQ PRE-FLIGHT (JWT tool check) │
│ verify_step() for each tool         │
└─────────────────────────────────────┘
     │
     ├─ Any tool fails? ──► task blocked, stop
     │
    All verified
     │
     ▼
┌──────────────────┐   Provider: Ollama (fast)
│ STEP 1: ANALYZER │   Progress: 0% → 25%
│ (Intent Breakdwn)│   Latency: 1–3s
│                  │
│ Input:  user_req │
│ Output: analysis │
└────────┬─────────┘
         │ Pass analysis text as context
         ▼
┌──────────────────┐   Provider: Gemini 2.5 Flash (accurate)
│ STEP 2: EXECUTOR │   Progress: 25% → 50%
│ (Execute actions)│   Latency: 2–5s
│                  │
│ Input:  analysis │
│ Output: execution│
└────────┬─────────┘
         │ Pass execution output as context
         ▼
┌──────────────────┐   Provider: Ollama (fast)
│ STEP 3: VALIDATOR│   Progress: 50% → 75%
│ (Verify results) │   Latency: 1–3s
│                  │
│ Input:  execution│
│ Output: validation
└────────┬─────────┘
         │ Pass validation output as context
         ▼
┌──────────────────┐   Provider: Gemini 2.5 Flash (accurate)
│ STEP 4: REPORTER │   Progress: 75% → 100%
│ (Final report)   │   Latency: 2–5s
│                  │
│ Input:  all steps│
│ Output: report   │   ← This is shown in "Final Agent Report"
└────────┬─────────┘      panel in the frontend
         │
         ▼
┌──────────────────────────────────┐
│ task_update broadcast:           │
│   status: "completed"            │
│   progress: 100                  │
│   report: "<Reporter output>"    │
│   judgment: { ... }              │
└──────────────────────────────────┘
```

---

## Component Interactions

### Intent Classification Detail

```
Agent.classify_intent(user_request: str) → Dict
     │
     ├─ Builds structured prompt:
     │    "Analyze this request and classify it.
     │     Valid categories: read|write|code_change|delete_file|
     │     delete_database|deploy|system_command|admin_action
     │     Valid risk levels: low|medium|high|critical
     │     Respond ONLY with JSON: {category, risk_level, description, reasoning}"
     │
     ├─ Calls _call_ollama(prompt)
     │    │
     │    ├─ Success: Parse JSON response
     │    │           Strip markdown fences if present
     │    │           Validate required keys
     │    │           Return classification dict
     │    │
     │    └─ Failure: Keyword fallback
     │                Scan for: drop/delete/rm/deploy/push to prod
     │                Return safe default: {category: "read", risk_level: "low"}
     │
     └─ Returns: {category, risk_level, description, reasoning}
```

### RBAC Check Detail

```
ArmorIQClient.check_rbac(role: str, intent: dict) → RBACJudgment
     │
     ├─ Normalize: UserRole(role) — fallback to junior_engineer if invalid
     ├─ Normalize: IntentCategory(intent["category"]) — fallback to read
     │
     ├─ Lookup: RBAC_MATRIX[user_role][intent_cat]
     │          → PolicyAction (ALLOW / BLOCK / REQUIRE_APPROVAL)
     │
     ├─ ALLOW:
     │    judgment.allowed = True
     │    judgment.judgment_reason = "✅ ALLOWED — {role} has permission for '{intent}'"
     │
     ├─ REQUIRE_APPROVAL:
     │    judgment.allowed = False  (blocked until approval obtained offline)
     │    judgment.requires_approval_from = "Tech Lead or Admin"
     │    judgment.judgment_reason = "⏳ REQUIRES APPROVAL — {block_msg}"
     │
     └─ BLOCK:
          judgment.allowed = False
          judgment.judgment_reason = "🚫 BLOCKED — {block_msg}"
```

### Agent Processing Lifecycle

```
Agent Instance Created (IDLE state)
   │
   ▼
agent.process(task) called
   │
   ├─ Start timer
   ├─ Set status = "working"
   ├─ Increment execution_count
   │
   ▼
Provider routing:
   │
   ├─ OLLAMA (Analyzer & Validator)
   │    POST http://ollama:11434/api/generate
   │    model: qwen2:0.5b (or OLLAMA_MODEL env)
   │    Returns: response text + estimated token count
   │
   └─ GEMINI (Executor & Reporter)
        POST generativelanguage.googleapis.com/.../gemini-2.5-flash
        Falls back to Ollama on 401/403/429
        Returns: response text + usageMetadata token count
   │
   ▼
Build result: {action_id, agent_id, status, output, execution_time_ms,
               model, llm_provider, tokens_used}
   │
   ▼
Set status = "idle" → return result
```

### WebSocket Broadcasting Pattern

```
orchestrator._broadcast_progress(task_id, progress, step)
         │
         ▼
broadcast_update({
  "type": "task_progress",
  "task_id": "task-xyz",
  "progress": 50,
  "step": "executor",
  "status": "processing",
  "user_id": "session-abc"
})
         │
         ▼
For each active WebSocket:
  websocket.send_json(message)
         │
         ▼
Frontend: setTasks(prev => prev.map(t =>
  t.id === data.task_id
    ? { ...t, progress: data.progress, status: data.status }
    : t
))
```

---

## Orchestration Logic

### classify_and_judge() — New Pre-Pipeline Step

```python
async def classify_and_judge(task_id, user_request, role) -> RBACJudgment:
    analyzer = get_agent_by_role("analyzer")
    armoriq  = get_armoriq_client()

    # Step A: AI classifies intent (Ollama)
    intent = await analyzer.classify_intent(user_request)
    # → {category, risk_level, description, reasoning}

    # Step B: ArmorIQ checks role policy
    judgment = armoriq.check_rbac(role, intent)
    # → RBACJudgment(allowed, policy_action, judgment_reason, ...)

    return judgment
```

This runs BEFORE the 4-agent pipeline. If `judgment.allowed == False`, orchestrate() returns immediately with `status: "blocked"` and the judgment object. The pipeline never starts.

### Progress Events Timeline

```
Event                        Progress   WebSocket Type
──────────────────────────────────────────────────────
Intent classifier starts     0%         task_progress (step: intent_classifier)
RBAC judgment logged         0%         log (level: success|error)
Analyzer starts              0%         task_progress (step: analyzer)
Analyzer completes           25%        task_progress + agent_update
Executor starts              25%        task_progress (step: executor)
Executor completes           50%        task_progress + agent_update
Validator starts             50%        task_progress (step: validator)
Validator completes          75%        task_progress + agent_update
Reporter starts              75%        task_progress (step: reporter)
Reporter completes           100%       task_progress + agent_update
Final task_update            100%       task_update {report, judgment, status}
```

### Error Handling Strategy

```
Each step:

1. Call agent.process(task)
   ├─ Try: call LLM → parse → return success result
   └─ Except: set status="error", return {status:"error", failed_step, error}

2. If failed_step set:
   ├─ Broadcast error log
   ├─ Return early: {status:"error", failed_step, blocked_reason}
   └─ task.status = "error" (not "blocked" — this is infra error not RBAC)
```

---

## Frontend Architecture

### Component Tree

```
App.tsx
├── State: tasks[], agents[], logs[], connected, role (UserRole)
├── role persisted to localStorage key "agentforge_role"
├── WebSocket: merges judgment + report into Task on task_update
│
├── ProfileSwitcher (header, top-right)    ← NEW in v2.0
│   ├── Shows current role with color + icon
│   ├── Dropdown: 4 roles with permission tags
│   └── onChange → setRole + localStorage
│
├── Dashboard.tsx
│   ├── Accepts: tasks, agents, sessionId, liveUsers, role
│   ├── Submit form: sends role in POST /api/jailbreak body
│   ├── TaskCard (per task)
│   │   ├── Progress bar + step name
│   │   ├── Role badge (shows which role submitted)
│   │   ├── [Expanded] JudgmentPanel    ← NEW in v2.0
│   │   │   ├── Detected intent category + role + risk level
│   │   │   ├── Intent description (what AI understood)
│   │   │   └── ArmorIQ decision (✅/🚫/⏳) + reason
│   │   └── [Expanded] AgentReport      ← NEW in v2.0
│   │       ├── Final Reporter (Gemini) output
│   │       └── Expand/collapse if > 4 lines
│   └── System Configuration panel (shows active role)
│
├── TaskFlow.tsx        — real-time pipeline step visualization
├── AgentBoard.tsx      — agent status grid with provider info
├── WorkflowVisualization.tsx — architecture diagram
└── DebugLog.tsx        — live log stream
```

### Role Configuration (ProfileSwitcher)

```typescript
const ROLE_CONFIG: Record<UserRole, {
  label: string       // "Junior Engineer"
  color: string       // CSS color for text/icons
  bg: string          // background for highlighted state
  border: string      // border color
  icon: string        // SVG path
  perms: string[]     // allowed intent categories (shown green ✓)
  blocked: string[]   // blocked (✗) or approval-required (⏳, suffix *)
}>
```

### Task Interface (v2.0)

```typescript
interface Task {
  id: string
  user_request: string
  status: 'queued' | 'processing' | 'blocked' | 'completed' | 'error'
  plan_id?: string
  blocked_reason?: string
  created_at: string
  progress: number
  user_id?: string
  role?: string           // ← NEW: which role submitted this task
  report?: string         // ← NEW: final Reporter agent output
  judgment?: RBACJudgment // ← NEW: full RBAC decision object
}

interface RBACJudgment {
  role: string
  intent_category: string
  risk_level: string
  intent_description: string
  intent_reasoning: string
  policy_action: 'allow' | 'block' | 'require_approval'
  judgment_reason: string
  requires_approval_from?: string
  allowed: boolean
  timestamp: string
}
```

### WebSocket Message Flow (v2.0)

```
Frontend App.tsx receives task_update:

ws.onmessage → parse JSON
  │
  ├─ type: "task_update"
  │    setTasks(prev.map(t =>
  │      t.id === data.task.id
  │        ? { ...t, ...data.task }  // merges judgment + report automatically
  │        : t
  │    ))
  │
  ├─ type: "task_progress"
  │    Updates progress + status on the task card
  │
  ├─ type: "agent_update"
  │    Updates agent status in AgentBoard
  │
  └─ type: "log"
       Prepended to logs[] for DebugLog tab
```

---

## Error Handling & Recovery

### Scenario 1: RBAC Blocks Request (Most Common)

```
junior_engineer requests "delete the database"
         │
         ▼
classify_intent() → {category: "delete_database", risk_level: "critical"}
         │
         ▼
check_rbac("junior_engineer", intent) → allowed=False
         │
         ▼
orchestrate() returns immediately:
{
  status: "blocked",
  blocked_reason: "🚫 BLOCKED — Junior engineers cannot delete databases.",
  judgment: { intent_category: "delete_database", risk_level: "critical", ... }
}
         │
         ▼
Frontend: task.status = "blocked"
          JudgmentPanel shows full explanation
          No LLM tokens consumed (fast, no cost)
```

### Scenario 2: Ollama Not Running

```
classify_intent() or Analyzer step calls _call_ollama()
         │
         ▼
httpx.ConnectError → keyword fallback for classify_intent()
                   → error result for agent steps
         │
         ▼
orchestrate() returns {status: "error", failed_step: "analyzer"}
Frontend: task shows ERROR badge
```

### Scenario 3: Gemini Auth/Rate Error

```
Executor or Reporter calls _call_gemini()
         │
         ▼
HTTP 401/403/429 → automatic fallback to _call_ollama()
HTTP 5xx         → exception → task.status = "error"
No API key       → fallback to Ollama immediately (no error)
```

### Scenario 4: Intent Classification JSON Parse Fails

```
Ollama returns malformed JSON for classify_intent()
         │
         ▼
json.loads() raises exception
         │
         ▼
Keyword fallback activates:
  "delete"/"rm " → {category: "delete_file", risk_level: "high"}
  "drop"         → {category: "delete_database", risk_level: "critical"}
  "deploy"       → {category: "deploy", risk_level: "high"}
  default        → {category: "read", risk_level: "low"}
```

---

## Performance Optimization

### Latency Profile

```
Operation                     Latency     Notes
─────────────────────────────────────────────────────────
Request → Backend             < 50ms      FastAPI async
ArmorIQ token gen/verify      < 10ms      Local JWT (no network)
Intent classification (Ollama) 1–3s       Structured JSON prompt
RBAC check                    < 1ms       In-memory dict lookup
Tool pre-flight verify         < 5ms      Local JWT decode
Analyzer step (Ollama)         1–3s
Executor step (Gemini)         2–5s
Validator step (Ollama)        1–3s
Reporter step (Gemini)         2–5s
DB write (SpacetimeDB)         < 50ms
WebSocket broadcast            < 30ms
─────────────────────────────────────────────────────────
TOTAL (blocked by RBAC)        ~2–4s      Intent classify only
TOTAL (allowed, full pipeline) ~8–18s     4-agent + classify
```

### Cost Optimization

```
Role-based RBAC eliminates unnecessary LLM calls for blocked requests.

Blocked request cost:
  1 Ollama call (classify_intent) = FREE (local)
  0 Gemini calls                  = $0.00

Allowed request cost per pipeline:
  2 Ollama calls (Analyzer + Validator) = FREE (local)
  2 Gemini calls (Executor + Reporter)  ≈ $0.00015 per task
```

---

## Scalability Considerations

### Horizontal Scaling

```
Current Architecture (Single Server):
─────────────────────────────────────
Backend (FastAPI) + 4 agents
SpacetimeDB (embedded)
Ollama (local inference)
Handles: ~100 concurrent users / ~10 tasks per minute


For 1000+ Concurrent Users:
─────────────────────────────────────
Load Balancer (nginx)
     ├── Backend Pod 1 (FastAPI)
     ├── Backend Pod 2 (FastAPI)
     └── Backend Pod N (FastAPI)
          │
          ├── Shared PostgreSQL (SpacetimeDB backend)
          ├── Redis pub/sub (WebSocket broadcast)
          └── Ollama Cluster (GPU inference)
```

### Bottlenecks

```
#1 Ollama inference — ~5–10 concurrent tasks per GPU
   Solution: GPU cluster with load balancer

#2 Gemini API rate limit — 15,000 RPM shared
   Solution: Per-user quota, request caching

#3 WebSocket connections — ~10,000 per server
   Solution: Redis pub/sub for multi-server broadcast
```

---

## Database Schema

### Core Tables

```sql
-- Tasks (extended in v2.0 with role)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'junior_engineer',   -- NEW in v2.0
  status TEXT,           -- queued|processing|completed|blocked|error
  progress INTEGER DEFAULT 0,
  user_request TEXT NOT NULL,
  plan_id TEXT,
  blocked_reason TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Security Events (includes rbac_judgment events)
CREATE TABLE security_events (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  event_type TEXT,       -- verification_failed|policy_violation|rbac_judgment
  severity TEXT,         -- blocked|warning|info
  details TEXT,          -- JSON: {role, intent_category, judgment_reason, ...}
  created_at TIMESTAMP
);

-- Agent Actions
CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  agent_id TEXT,
  action_type TEXT,      -- analyze|execute|validate|report
  output TEXT,
  execution_time_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMP
);

-- Results (includes judgment in v2.0)
CREATE TABLE results (
  id TEXT PRIMARY KEY,
  task_id TEXT UNIQUE,
  status TEXT,
  output TEXT,           -- JSON: {analysis, execution, validation, report}
  verification_status TEXT,
  tokens_used_total INTEGER,
  created_at TIMESTAMP
);
```

---

## API Reference

### Updated Endpoints (v2.0)

#### POST /api/jailbreak
Submit a request — now requires `role` field.

```http
POST /api/jailbreak HTTP/1.1
Content-Type: application/json

{
  "user_request": "Delete the old config file",
  "context": {},
  "user_id": "session-abc-123",
  "role": "junior_engineer"
}

Response (blocked by RBAC):
{
  "task_id": "task-xyz789",
  "status": "blocked",
  "plan_id": "intent-hash-123",
  "blocked_reason": "🚫 BLOCKED — Junior engineers cannot delete files.",
  "judgment": null,
  "message": "Request submitted — role='junior_engineer'. Intent will be classified and RBAC enforced before execution."
}

Response (queued):
{
  "task_id": "task-abc123",
  "status": "queued",
  "plan_id": "intent-hash-456",
  "blocked_reason": null,
  "judgment": null,
  "message": "Request submitted — role='senior_developer'..."
}
```

#### GET /api/roles ← NEW in v2.0
Returns available roles and full permission matrix.

```http
GET /api/roles HTTP/1.1

Response:
{
  "roles": ["junior_engineer", "senior_developer", "tech_lead", "admin"],
  "intent_categories": ["read", "write", "code_change", "delete_file",
                         "delete_database", "deploy", "system_command", "admin_action"],
  "permission_matrix": {
    "junior_engineer": {
      "read": "allow",
      "write": "allow",
      "code_change": "allow",
      "delete_file": "block",
      "delete_database": "block",
      "deploy": "block",
      "system_command": "block",
      "admin_action": "block"
    },
    "senior_developer": { ... },
    "tech_lead": { ... },
    "admin": { "read": "allow", "write": "allow", ... }
  }
}
```

#### GET /api/tasks/{task_id}
Returns task details including role and judgment.

```http
GET /api/tasks/task-xyz789 HTTP/1.1

Response:
{
  "task_id": "task-xyz789",
  "status": "completed",
  "user_request": "Analyze Q1 sales data",
  "role": "senior_developer",
  "plan_id": "intent-hash-123",
  "blocked_reason": null,
  "actions": [...],
  "created_at": "2026-04-17T10:30:00Z",
  "updated_at": "2026-04-17T10:30:20Z",
  "user_id": "session-abc-123"
}
```

#### GET /health
System health check.

```http
GET /health HTTP/1.1

{
  "status": "ok",
  "service": "agentforge-backend",
  "version": "0.1.0",
  "armoriq": "enabled",
  "spacetimedb": "connected",
  "timestamp": "2026-04-17T10:30:45Z"
}
```

#### Other Endpoints (unchanged)

| Method | Path | Description |
|---|---|---|
| GET | `/api/agents` | All agent statuses + providers |
| GET | `/api/plans` | List all tasks |
| GET | `/api/plans/{plan_id}` | Task + tool plan details |
| GET | `/api/history` | ArmorIQ verification log |
| GET | `/api/armoriq/stats` | Blocked/allowed counts |
| GET | `/api/armoriq/policies` | Active policy rules |
| GET | `/api/armoriq/audit-trail` | Full audit trail |
| POST | `/api/armoriq/generate-token` | Generate intent token |
| POST | `/api/armoriq/verify-token` | Verify intent token |
| POST | `/api/armoriq/verify-step` | Verify a tool step |
| WS | `/ws/updates` | Real-time WebSocket |

### WebSocket Messages (v2.0)

```json
// task_update — now includes judgment + report
{
  "type": "task_update",
  "task": {
    "id": "task-xyz",
    "status": "completed",
    "progress": 100,
    "report": "## Analysis Report\n\nQ1 sales showed...",
    "judgment": {
      "role": "senior_developer",
      "intent_category": "read",
      "risk_level": "low",
      "intent_description": "User wants to analyze Q1 sales data.",
      "policy_action": "allow",
      "judgment_reason": "✅ ALLOWED — senior_developer has permission for 'read' actions.",
      "allowed": true
    },
    "user_id": "session-abc-123"
  },
  "timestamp": "2026-04-17T10:30:45Z"
}

// security_event — now includes rbac_judgment type
{
  "type": "security_event",
  "severity": "blocked",
  "message": "ArmorIQ BLOCKED: delete_file — 🚫 Junior engineers cannot delete files.",
  "task_id": "task-xyz",
  "timestamp": "2026-04-17T10:30:45Z"
}
```

---

## Deployment Architecture

### Docker Compose Stack

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      OLLAMA_API_URL: http://host.docker.internal:11434
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      SPACETIMEDB_URL: http://spacetimedb:3000
      ARMORIQ_SECRET_KEY: ${ARMORIQ_SECRET_KEY}
    depends_on: [spacetimedb]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    environment:
      VITE_BACKEND_URL: http://localhost:8001

  spacetimedb:
    image: clockworklabs/spacetimedb:latest
    ports: ["3000:3000"]
```

> **Note:** Ollama runs on the host machine (not in Docker) for GPU access.
> Backend connects via `host.docker.internal:11434`.

### Environment Variables

```bash
# Required
GEMINI_API_KEY=your-key-from-https://ai.google.dev/

# Optional (have defaults)
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=qwen2:0.5b
SPACETIMEDB_URL=http://localhost:3000
ARMORIQ_SECRET_KEY=dev-secret-key    # Use strong value in production
ARMORIQ_TOKEN_VALIDITY=600           # JWT expiry in seconds
```

### Git Repository Configuration

`.gitignore` tracks ONLY project source files:

```
Ignored (never committed):
  backend/venv/           Python virtualenv (~2400 files)
  frontend/node_modules/  NPM packages (~3800 files)
  backend/app/__pycache__ Compiled bytecode
  .env                    Secrets / API keys
  *.log, build_*.txt      Build artifacts

Tracked (47 files):
  All source code, configs, Dockerfiles, requirements.txt,
  package.json, CLAUDE.md, docker-compose.yml
```

---

## Development Workflow

### Local Development

```bash
# 1. Start Ollama (host machine)
ollama serve
ollama pull qwen2:0.5b   # or mistral

# 2. Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd frontend
npm install
npm run dev    # → http://localhost:5173

# 4. Full stack (Docker)
docker-compose up --build
```

### Testing RBAC

```bash
# Junior engineer trying to delete a file → BLOCKED
curl -X POST http://localhost:8000/api/jailbreak \
  -H "Content-Type: application/json" \
  -d '{"user_request": "delete the old config.js file", "role": "junior_engineer"}'

# Senior developer same request → ALLOWED
curl -X POST http://localhost:8000/api/jailbreak \
  -H "Content-Type: application/json" \
  -d '{"user_request": "delete the old config.js file", "role": "senior_developer"}'

# Anyone → drop database → BLOCKED (needs approval)
curl -X POST http://localhost:8000/api/jailbreak \
  -H "Content-Type: application/json" \
  -d '{"user_request": "drop the production database", "role": "senior_developer"}'

# Admin → drop database → ALLOWED
curl -X POST http://localhost:8000/api/jailbreak \
  -H "Content-Type: application/json" \
  -d '{"user_request": "drop the production database", "role": "admin"}'

# View role permission matrix
curl http://localhost:8000/api/roles | python3 -m json.tool
```

### Key Files by Feature

```
RBAC & Intent:
  backend/app/armoriq_integration.py  — UserRole, IntentCategory, RBAC_MATRIX,
                                        RBACJudgment, check_rbac()
  backend/app/agents.py               — Agent.classify_intent()
  backend/app/orchestrator.py         — classify_and_judge(), orchestrate(role=)

API:
  backend/app/main.py                 — UserRequest.role, /api/roles,
                                        process_task_with_armoriq(role=)

Frontend:
  frontend/src/App.tsx                — UserRole type, RBACJudgment type,
                                        ProfileSwitcher, role state
  frontend/src/components/Dashboard.tsx — JudgmentPanel, AgentReport,
                                          role prop, role in POST body
```

---

## Monitoring & Observability

### Key Metrics

```
RBAC Metrics (new):
  - Blocked requests by role
  - Most blocked intent categories
  - Approval-required rate

Application Metrics:
  - Task completion rate
  - Average pipeline latency
  - Tasks by status
  - Agent execution count

Performance Metrics:
  - LLM inference latency by provider
  - Intent classification latency
  - WebSocket message latency

Cost Metrics:
  - Gemini API tokens used
  - Blocked rate (saves tokens)
  - Cost per completed task ≈ $0.00015
```

---

**Version:** 2.0.0 | **Updated:** April 17 2026 | **Status:** Production Ready ✓
