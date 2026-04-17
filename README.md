# 🤖 AgentForge - AI Agent Orchestration Platform

A secure, multi-agent AI orchestration system with real-time collaboration, ArmorIQ security enforcement, and intelligent code assistance.

![AgentForge](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![React](https://img.shields.io/badge/React-18-blue)

## ✨ Features

- 🤖 **4-Agent Pipeline**: Analyzer → Executor → Validator → Reporter
- 🔒 **ArmorIQ Security**: Intent verification, RBAC, policy enforcement
- 💬 **AI Code Assistant**: Chat-based code editing with diff viewer
- 📁 **File Explorer**: Browse, edit, and manage project files
- 🔄 **Real-time Updates**: WebSocket-based live collaboration
- 🎨 **Modern UI**: React + TypeScript + Tailwind CSS
- 🗄️ **SpacetimeDB**: Real-time database with pub/sub
- 🧠 **Dual LLM**: Ollama (local) + Gemini (cloud) with fallback

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Docker & Docker Compose
- Ollama (optional, for local LLM)
- API Keys: [Gemini](https://ai.google.dev/), [ArmorIQ](https://armoriq.ai/)

### 1. Clone & Configure
```bash
git clone https://github.com/yourusername/agentforge.git
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
- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:8001
- **Health Check**: http://localhost:8001/health

## 🆓 Free Deployment (Students)

### Option 1: Render (FREE - Recommended)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Fork this repo
2. Go to [Render](https://render.com)
3. Click "New +" → "Blueprint"
4. Connect your GitHub repo
5. Add environment variables:
   - `GEMINI_API_KEY`
   - `ARMORIQ_API_KEY`
   - `ARMORIQ_SECRET_KEY`
6. Click "Apply"

**Free Tier**: 750 hours/month, auto-sleep after 15 min inactivity

### Option 2: Railway (FREE $5 Credit)
```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

**Free Tier**: $5 credit/month (enough for development)

### Option 3: Fly.io (FREE 3 VMs)
```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
flyctl launch
flyctl deploy
```

**Free Tier**: 3 shared VMs, 3GB storage

## 📖 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete system architecture
- **API Docs**: http://localhost:8001/docs (after deployment)

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

## 🛠️ Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- WebSocket (real-time)

**Backend**
- FastAPI (Python 3.11)
- Uvicorn (ASGI server)
- httpx (async HTTP)
- python-jose (JWT)

**Database**
- SpacetimeDB (real-time)

**AI/LLM**
- Ollama (local inference)
- Google Gemini (cloud API)

**Security**
- ArmorIQ (intent verification)
- RBAC (role-based access)

## 📁 Project Structure

```
agentforge/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── agents.py            # 4-agent system
│   │   ├── orchestrator.py      # Pipeline coordinator
│   │   ├── codespace.py         # File operations
│   │   ├── armoriq_integration.py
│   │   └── spacetime.py         # Database client
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main app
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Codespace.tsx    # AI code assistant
│   │   │   ├── AgentBoard.tsx
│   │   │   └── TaskFlow.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
├── spacetimedb/
│   └── src/lib.rs               # Database schema
├── docker-compose.yml
├── .env.example
├── README.md
└── ARCHITECTURE.md
```

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

### User Roles

| Role | Permissions |
|------|-------------|
| **junior_engineer** | Read, basic code changes |
| **senior_developer** | Read, write, code changes, file operations |
| **tech_lead** | All above + delete files, deploy |
| **admin** | Full access including database operations |

## 🧪 Testing

```bash
# Health check
curl http://localhost:8001/health

# Run integration tests
./test_integration.sh

# Check all services
./health.sh
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/agents` | GET | Agent status |
| `/api/jailbreak` | POST | Submit task |
| `/api/tasks/{id}` | GET | Task details |
| `/api/codespace/tree` | GET | File tree |
| `/api/codespace/file` | GET | Read file |
| `/api/codespace/suggest` | POST | AI code suggestion |
| `/api/codespace/apply` | POST | Write file |
| `/ws/updates` | WS | Real-time updates |

Full API docs: http://localhost:8001/docs

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) - Local LLM inference
- [Google Gemini](https://ai.google.dev/) - Cloud LLM API
- [ArmorIQ](https://armoriq.ai/) - AI security platform
- [SpacetimeDB](https://spacetimedb.com/) - Real-time database
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://react.dev/) - UI library

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/agentforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/agentforge/discussions)

## 🌟 Star History

If you find this project useful, please consider giving it a star ⭐

---

**Built with ❤️ by developers, for developers**
