import { useState, useEffect, useCallback } from 'react'
import Dashboard from './components/Dashboard'
import TaskFlow from './components/TaskFlow'
import AgentBoard from './components/AgentBoard'
import DebugLog from './components/DebugLog'
import WorkflowVisualization from './components/WorkflowVisualization'
import Codespace from './components/Codespace'

// Session ID generation and persistence
const SESSION_ID_KEY = 'agentforge_session_id'

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}

const SESSION_ID = getOrCreateSessionId()

// Backend base URL — read from Vite env so the browser hits the backend directly,
// avoiding the Vite dev server proxy (which runs inside Docker and can't reach
// a host-networked backend across Docker bridge iptables rules).
const BACKEND_HTTP = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8001'
const BACKEND_WS   = BACKEND_HTTP.replace(/^http/, 'ws')

export type UserRole = 'junior_engineer' | 'senior_developer' | 'tech_lead' | 'admin'

export interface RBACJudgment {
  role: string
  intent_category: string
  risk_level: string
  intent_description: string
  intent_reasoning: string
  policy_action: string
  judgment_reason: string
  requires_approval_from?: string
  allowed: boolean
  timestamp: string
}

export interface Task {
  id: string
  user_request: string
  status: 'queued' | 'processing' | 'blocked' | 'completed' | 'error'
  plan_id?: string
  blocked_reason?: string
  created_at: string
  progress: number
  user_id?: string
  role?: string
  report?: string
  judgment?: RBACJudgment
  // Codespace fields
  task_type?: string
  file_path?: string
  suggested_content?: string
  diff_lines?: Array<{
    type: 'context' | 'added' | 'removed'
    orig_no: number | null
    mod_no: number | null
    content: string
  }>
}

export interface Agent {
  id: string
  name: string
  role: string
  status: 'idle' | 'working' | 'error'
  last_task_id?: string
  execution_count: number
  capabilities: string[]
  llm_provider?: 'ollama' | 'gemini'
  model?: string
  current_task_user_id?: string
}

export interface LogEntry {
  timestamp: string
  type: 'info' | 'success' | 'error' | 'warning' | 'security'
  message: string
  task_id?: string
}

const ROLE_CONFIG: Record<UserRole, {
  label: string
  color: string
  bg: string
  border: string
  icon: string
  perms: string[]
  blocked: string[]
}> = {
  junior_engineer: {
    label: 'Junior Engineer',
    color: '#60a5fa',
    bg: 'rgba(59,130,246,.12)',
    border: 'rgba(59,130,246,.25)',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    perms: ['read', 'write', 'code_change'],
    blocked: ['delete_file', 'delete_database', 'deploy', 'system_command', 'admin_action'],
  },
  senior_developer: {
    label: 'Senior Developer',
    color: '#a78bfa',
    bg: 'rgba(139,92,246,.12)',
    border: 'rgba(139,92,246,.25)',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    perms: ['read', 'write', 'code_change', 'delete_file', 'deploy'],
    blocked: ['delete_database*', 'system_command*', 'admin_action'],
  },
  tech_lead: {
    label: 'Tech Lead',
    color: '#fb923c',
    bg: 'rgba(249,115,22,.12)',
    border: 'rgba(249,115,22,.25)',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    perms: ['read', 'write', 'code_change', 'delete_file', 'deploy', 'system_command'],
    blocked: ['delete_database*', 'admin_action*'],
  },
  admin: {
    label: 'Admin',
    color: '#f87171',
    bg: 'rgba(239,68,68,.12)',
    border: 'rgba(239,68,68,.25)',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    perms: ['read', 'write', 'code_change', 'delete_file', 'delete_database', 'deploy', 'system_command', 'admin_action'],
    blocked: [],
  },
}

const ROLE_KEY = 'agentforge_role'

function ProfileSwitcher({ role, onChange }: { role: UserRole; onChange: (r: UserRole) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = ROLE_CONFIG[role]
  const roles = Object.entries(ROLE_CONFIG) as [UserRole, typeof cfg][]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px',
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all .2s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={cfg.icon} />
        </svg>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '.65rem', color: '#475569', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Active Role</div>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100,
          background: 'rgba(8,11,22,.98)',
          border: '1px solid rgba(99,102,241,.2)',
          borderRadius: 12,
          padding: 8,
          minWidth: 320,
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}>
          <div style={{ fontSize: '.68rem', color: '#475569', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 10px 8px' }}>
            Switch Development Profile
          </div>
          {roles.map(([r, c]) => (
            <button
              key={r}
              onClick={() => { onChange(r); setOpen(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 12px',
                background: r === role ? c.bg : 'transparent',
                border: `1px solid ${r === role ? c.border : 'transparent'}`,
                borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
                marginBottom: 3,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d={c.icon} />
              </svg>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '.82rem', fontWeight: 700, color: c.color }}>{c.label}</span>
                  {r === role && <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 999, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 700 }}>ACTIVE</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {c.perms.map(p => (
                    <span key={p} style={{ fontSize: '.6rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,.2)' }}>✓ {p}</span>
                  ))}
                  {c.blocked.slice(0, 3).map(p => (
                    <span key={p} style={{ fontSize: '.6rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,.08)', color: '#f87171', border: '1px solid rgba(239,68,68,.15)' }}>
                      {p.endsWith('*') ? '⏳' : '✗'} {p.replace('*', '')}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
          <div style={{ fontSize: '.65rem', color: '#334155', padding: '6px 10px 2px', borderTop: '1px solid rgba(99,102,241,.1)', marginTop: 4 }}>
            ✓ = allowed &nbsp;✗ = blocked &nbsp;⏳ = requires approval
          </div>
        </div>
      )}
    </div>
  )
}

type Tab = 'dashboard' | 'flow' | 'agents' | 'workflow' | 'debug' | 'codespace'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'flow',      label: 'Task Flow',    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 'agents',    label: 'Agents',       icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'workflow',  label: 'Architecture', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { id: 'debug',     label: 'Live Logs',    icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'codespace', label: 'Codespace',    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [logs,      setLogs]      = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveUsers, setLiveUsers] = useState(1)
  const [role, setRole] = useState<UserRole>(() =>
    (localStorage.getItem(ROLE_KEY) as UserRole) || 'junior_engineer'
  )

  const handleRoleChange = (r: UserRole) => {
    setRole(r)
    localStorage.setItem(ROLE_KEY, r)
  }

  const addLog = useCallback((type: LogEntry['type'], message: string, taskId?: string) => {
    setLogs(prev => [{
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      type,
      message,
      task_id: taskId,
    }, ...prev].slice(0, 200))
  }, [])

  // WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      try {
        const backendUrl = `${BACKEND_WS}/ws/updates?session_id=${SESSION_ID}`
        console.log('Connecting WebSocket to:', backendUrl)
        ws = new WebSocket(backendUrl)

        ws.onopen = () => {
          setConnected(true)
          setError(null)
          addLog('success', 'WebSocket connected to backend')
          console.log('WebSocket connected')
        }

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)

            // Existing tasks snapshot on fresh connect
            if (data.type === 'existing_tasks') {
              setTasks(data.tasks as Task[])
              return
            }

            // Live user count updates
            if (data.type === 'users_update') {
              setLiveUsers(data.connected_users as number)
              return
            }

            // Task progress updates (real-time 0-100%)
            if (data.type === 'task_progress') {
              setTasks(prev => {
                const exists = prev.find(t => t.id === data.task_id)
                return exists
                  ? prev.map(t => t.id === data.task_id
                      ? { ...t, progress: data.progress, status: data.status }
                      : t)
                  : [...prev, {
                      id: data.task_id,
                      user_request: `Step: ${data.step}`,
                      status: data.status,
                      created_at: new Date().toISOString(),
                      progress: data.progress,
                    }]
              })
            }

            // Full task updates
            if (data.type === 'task_update') {
              setTasks(prev => {
                const exists = prev.find(t => t.id === data.task.id)
                return exists
                  ? prev.map(t => t.id === data.task.id ? { ...t, ...data.task } : t)
                  : [...prev, data.task]
              })
              addLog('info', `Task ${data.task.id} — ${data.task.status}`, data.task.id)
            }

            // Agent status updates with provider info
            if (data.type === 'agent_update') {
              setAgents(prev => {
                const exists = prev.find(a => a.id === data.agent.id)
                return exists
                  ? prev.map(a => a.id === data.agent.id ? { ...a, ...data.agent } : a)
                  : [...prev, data.agent]
              })
            }

            // Security events
            if (data.type === 'security_event') {
              addLog(data.severity === 'blocked' ? 'error' : 'security', data.message, data.task_id)
            }

            // Execution logs
            if (data.type === 'log') {
              addLog(data.level || 'info', data.message, data.task_id)
            }
          } catch { /* ignore parse errors */ }
        }

        ws.onerror = (ev) => {
          console.error('WebSocket error:', ev)
          setConnected(false)
          setError('WebSocket connection error')
          addLog('error', 'WebSocket connection error')
        }

        ws.onclose = () => {
          setConnected(false)
          addLog('warning', 'WebSocket disconnected — retrying in 3s')
          retryTimer = setTimeout(connect, 3000)
        }
      } catch (e) {
        console.error('Failed to establish WebSocket connection:', e)
        setError(`WebSocket error: ${e}`)
        addLog('error', `Failed to establish WebSocket connection: ${e}`)
      }
    }

    connect()
    return () => {
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [addLog])

  // Poll agents
  useEffect(() => {
    const fetch_ = () => {
      return fetch(`${BACKEND_HTTP}/api/agents`)
        .then(r => r.json())
        .then(d => {
          setAgents(Object.values(d.agents || {}))
          setError(null)
        })
        .catch((e) => {
          console.error('Failed to fetch agents:', e)
          setError(`Failed to connect to backend: ${e.message}`)
        })
    }

    fetch_()
    const t = setInterval(fetch_, 5000)
    return () => clearInterval(t)
  }, [])

  const stats = {
    total:     tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    blocked:   tasks.filter(t => t.status === 'blocked').length,
    active:    agents.filter(a => a.status === 'working').length,
    agents:    agents.length,
    logCount:  logs.length,
    liveUsers,
  }

  // Non-blocking backend notice (shown as a banner inside the layout, not a full-screen error)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(180deg, rgba(10,14,28,.98) 0%, rgba(8,11,22,.95) 100%)',
        borderBottom: '1px solid rgba(99,102,241,.15)',
        paddingBottom: '0',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '22px 32px 0' }}>

          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                {/* Logo icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(99,102,241,.4)',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.02em' }}>
                  <span className="gradient-text">AgentForge</span>
                </h1>
                <span className="badge badge-purple" style={{ marginTop: 2 }}>v0.1.0</span>
              </div>
              <p style={{ margin: 0, fontSize: '.825rem', color: '#64748b', letterSpacing: '.01em' }}>
                Multi-Agent AI Orchestration Platform — ArmorIQ Intent Verification + SpacetimeDB Real-time Sync
              </p>
            </div>

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ProfileSwitcher role={role} onChange={handleRoleChange} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px',
                background: connected ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
                border: `1px solid ${connected ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}`,
                borderRadius: 8,
              }}>
                <div className={connected ? 'dot-live' : 'dot-dead'} />
                <span style={{ fontSize: '.8rem', fontWeight: 600, color: connected ? '#6ee7b7' : '#fca5a5' }}>
                  {connected ? 'Live' : 'Offline'}
                </span>
                <span style={{ fontSize: '.75rem', color: '#475569' }}>{BACKEND_WS}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, margin: '20px 0 0' }}>
            {[
              { label: 'Total Tasks',   value: stats.total,     color: '#93c5fd' },
              { label: 'Completed',     value: stats.completed,color: '#6ee7b7' },
              { label: 'Blocked',       value: stats.blocked,  color: '#fca5a5' },
              { label: 'Active Agents', value: `${stats.active}/${stats.agents}`, color: '#c4b5fd' },
              { label: 'Log Entries',   value: stats.logCount, color: '#fde68a' },
              { label: 'Live Users',    value: stats.liveUsers, color: '#34d399' },
            ].map(s => (
              <div className="stat-pill" key={s.label}>
                <span style={{ fontSize: '.68rem', fontWeight: 600, color: '#475569', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {s.label}
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: s.color }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {/* Nav tabs */}
          <nav style={{ display: 'flex', gap: 2, marginTop: 18, overflowX: 'auto' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`nav-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ background: 'none', border: 'none' }}
              >
                <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>
        {activeTab === 'dashboard'  && <Dashboard tasks={tasks} agents={agents} sessionId={SESSION_ID} liveUsers={liveUsers} role={role} onTaskSubmit={() => {}} onTaskCreated={(t) => setTasks([t, ...tasks])} />}
        {activeTab === 'flow'       && <TaskFlow tasks={tasks} sessionId={SESSION_ID} />}
        {activeTab === 'agents'     && <AgentBoard agents={agents} sessionId={SESSION_ID} logs={logs} tasks={tasks} />}
        {activeTab === 'workflow'   && <WorkflowVisualization tasks={tasks} />}
        {activeTab === 'debug'      && <DebugLog logs={logs} />}
        {activeTab === 'codespace'  && <Codespace tasks={tasks} role={role} sessionId={SESSION_ID} />}
      </main>
    </div>
  )
}
