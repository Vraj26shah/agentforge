# 🤖 AgentForge — AI Agent Orchestration Platform

A secure, multi-agent AI orchestration system with real-time collaboration, ArmorIQ security enforcement, and intelligent code assistance.

![AgentForge](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![React](https://img.shields.io/badge/React-18-blue)

## 🌐 Live Demo

> **Try it now →** [https://agentforges.onrender.com/](https://agentforges.onrender.com/)

---

## ✨ Features

- 🤖 **4-Agent Pipeline** — Analyzer → Executor → Validator → Reporter
- 🔒 **ArmorIQ Security** — Intent verification, RBAC, policy enforcement
- 💬 **AI Code Assistant** — Chat-based code editing with diff viewer
- 📁 **File Explorer** — Browse, edit, and manage project files
- 🔄 **Real-time Updates** — WebSocket-based live collaboration
- 🎨 **Modern UI** — React + TypeScript + Tailwind CSS
- 🗄️ **SpacetimeDB** — Real-time database with pub/sub
- 🧠 **Dual LLM** — Ollama (local) + Gemini (cloud) with automatic fallback

---

## 🔒 What is ArmorIQ?

[ArmorIQ](https://armoriq.ai/) is an AI security platform that provides **intent verification** and **policy enforcement** for AI agent systems. AgentForge integrates ArmorIQ to ensure every action an agent takes is authorized and auditable.

**How AgentForge uses ArmorIQ:**

| Capability | Description |
|---|---|
| **Intent Token Generation** | Every user request is hashed and signed into a JWT-based intent token that proves _what_ the user asked and _which_ tools were approved. |
| **Pre-flight Tool Verification** | Before each agent executes a tool, ArmorIQ verifies the tool is part of the approved execution plan. Unauthorized tools are blocked immediately (fail-closed). |
| **RBAC Policy Enforcement** | A role-based access control matrix (`junior_engineer` → `senior_developer` → `tech_lead` → `admin`) determines which intent categories (read, write, delete, deploy, etc.) each role is allowed to perform. |
| **Dangerous Operation Blocking** | Built-in policies automatically block destructive keywords like `rm -rf`, `drop database`, and `delete all` regardless of role. |
| **Audit Trail** | Every verification decision — allowed or blocked — is logged with timestamps for full traceability. |

---

## 🗄️ What is SpacetimeDB?

[SpacetimeDB](https://spacetimedb.com/) is a real-time database with built-in pub/sub that eliminates the need for a separate server between your application and database. AgentForge uses SpacetimeDB for persistent storage and real-time data synchronization.

**How AgentForge uses SpacetimeDB:**

| Capability | Description |
|---|---|
| **Task Persistence** | All tasks, their statuses, and progress are stored via SpacetimeDB reducers so data survives restarts. |
| **Agent Action Logging** | Every action taken by the 4-agent pipeline is logged to the `Action` table with agent ID, action type, and output. |
| **Security Event Storage** | ArmorIQ security events (blocks, approvals) are persisted in the `SecurityEvent` table with severity levels. |
| **Result Storage** | Final task results, verification status, and token usage are stored for historical reference. |
| **Graceful Degradation** | If SpacetimeDB is offline, the backend continues to function — all DB writes are fire-and-forget with warning logs, ensuring agent execution is never blocked by DB unavailability. |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
│  Dashboard | Task Flow | Agents | Codespace | Live Logs    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                   BACKEND (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ArmorIQ Security (Intent + RBAC)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  4-Agent Pipeline                                     │  │
│  │  Analyzer → Executor → Validator → Reporter          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼─────────────────┐
        │                │                 │
┌───────▼────────┐ ┌─────▼──────┐ ┌──────▼──────────┐
│  Ollama        │ │ SpacetimeDB│ │  Gemini API    │
│  (Local LLM)   │ │ (Database) │ │  (Cloud LLM)   │
└────────────────┘ └────────────┘ └────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, WebSocket |
| **Backend** | FastAPI (Python 3.11), Uvicorn, httpx, python-jose |
| **Database** | SpacetimeDB (real-time pub/sub) |
| **AI / LLM** | Ollama (local inference), Google Gemini (cloud API) |
| **Security** | ArmorIQ (intent verification + RBAC) |

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Ollama (optional, for local LLM)
- API Keys: [Gemini](https://ai.google.dev/), [ArmorIQ](https://armoriq.ai/)

### 1. Clone & Configure

```bash
git clone https://github.com/Vraj26shah/agentforge.git
cd agentforge

# Configure environment
cp .env.example .env
nano .env  # Add your API keys
```

### 2. Start Services

```bash
docker-compose up -d
```

### 3. Access

| Service | URL |
|---|---|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:8001 |
| Health Check | http://localhost:8001/health |
| API Docs | http://localhost:8001/docs |

---

## 📁 Project Structure

```
agentforge/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI application
│   │   ├── agents.py              # 4-agent system (Analyzer, Executor, Validator, Reporter)
│   │   ├── orchestrator.py        # Pipeline coordinator
│   │   ├── codespace.py           # File operations & AI code suggestions
│   │   ├── armoriq_integration.py # ArmorIQ security (JWT, RBAC, policies)
│   │   └── spacetime.py           # SpacetimeDB HTTP REST client
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Dashboard.tsx      # Task submission & history
│   │   │   ├── Codespace.tsx      # AI code assistant with diff viewer
│   │   │   ├── AgentBoard.tsx     # Agent status cards
│   │   │   └── TaskFlow.tsx       # Pipeline progress visualization
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
├── spacetimedb/
│   └── src/lib.rs                 # Database schema (Rust)
├── docker-compose.yml
├── render.yaml                    # Render deployment blueprint
├── .env.example
├── ARCHITECTURE.md
└── README.md
```

---

## 🔧 Configuration

### Environment Variables

```bash
# LLM Configuration
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=qwen2:0.5b
GEMINI_API_KEY=your_gemini_api_key

# ArmorIQ Security
ARMORIQ_API_KEY=your_armoriq_api_key
ARMORIQ_SECRET_KEY=your_secret_key

# Service URLs
VITE_BACKEND_URL=http://localhost:8001
SPACETIMEDB_URL=http://localhost:3001
```

### User Roles (RBAC)

| Role | Permissions |
|---|---|
| `junior_engineer` | Read, basic code changes |
| `senior_developer` | Read, write, code changes, file operations |
| `tech_lead` | All above + delete files, deploy |
| `admin` | Full access including database operations |

---

## 📊 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/agents` | GET | Agent status |
| `/api/jailbreak` | POST | Submit task |
| `/api/tasks/{id}` | GET | Task details |
| `/api/codespace/tree` | GET | File tree |
| `/api/codespace/file` | GET | Read file |
| `/api/codespace/suggest` | POST | AI code suggestion |
| `/api/codespace/apply` | POST | Write file |
| `/ws/updates` | WS | Real-time updates |

Full interactive API docs available at `/docs` after deployment.

---

## 🆓 Deployment

### Render (Recommended — FREE Tier)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Fork this repo
2. Go to [Render](https://render.com) → **New +** → **Blueprint**
3. Connect your GitHub repo
4. Add environment variables: `GEMINI_API_KEY`, `ARMORIQ_API_KEY`, `ARMORIQ_SECRET_KEY`
5. Click **Apply**

> Free Tier: 750 hours/month, auto-sleep after 15 min inactivity.

### Railway

```bash
npm i -g @railway/cli
railway login && railway init && railway up
```

### Fly.io

```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login && flyctl launch && flyctl deploy
```

---

## 🧪 Testing

```bash
# Health check
curl http://localhost:8001/health

# Run integration tests
./test_integration.sh

# Check all services
./health.sh
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License — see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) — Local LLM inference
- [Google Gemini](https://ai.google.dev/) — Cloud LLM API
- [ArmorIQ](https://armoriq.ai/) — AI security platform
- [SpacetimeDB](https://spacetimedb.com/) — Real-time database
- [FastAPI](https://fastapi.tiangolo.com/) — Python web framework
- [React](https://react.dev/) — UI library

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/Vraj26shah/agentforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Vraj26shah/agentforge/discussions)

---

If you find this project useful, please consider giving it a ⭐
