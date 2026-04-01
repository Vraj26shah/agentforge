import type { Task } from '../App'

const STACK = [
  { label: 'React + TypeScript',  sub: 'Vite 5 / Tailwind CSS',   color: '#06b6d4', layer: 'Frontend' },
  { label: 'FastAPI (Python)',     sub: '11 REST + WebSocket',      color: '#6366f1', layer: 'Backend'  },
  { label: 'ArmorIQ SDK',         sub: 'JWT + HMAC-SHA256',        color: '#8b5cf6', layer: 'Security' },
  { label: 'Ollama / Mistral',    sub: 'Local LLM Inference',      color: '#10b981', layer: 'LLM'      },
  { label: 'SpacetimeDB',         sub: 'Real-time Sync',           color: '#f59e0b', layer: 'Database' },
  { label: 'Docker Compose',      sub: '3-service orchestration',  color: '#94a3b8', layer: 'Infra'    },
]

const POLICIES = [
  { name: 'Allow Analysis Tools',   action: 'ALLOW',            priority: 10,  color: '#10b981' },
  { name: 'Allow Execution Tools',  action: 'ALLOW',            priority: 10,  color: '#10b981' },
  { name: 'Block Dangerous Ops',    action: 'BLOCK',            priority: 100, color: '#ef4444', critical: true },
  { name: 'Require System Approval',action: 'REQUIRE_APPROVAL', priority: 50,  color: '#f59e0b' },
]

const ENDPOINTS = [
  { method: 'POST', path: '/api/armoriq/generate-token', desc: 'Create cryptographic intent token' },
  { method: 'POST', path: '/api/armoriq/verify-token',   desc: 'Validate JWT signature & expiry'  },
  { method: 'POST', path: '/api/armoriq/verify-step',    desc: 'Check tool against intent + policy'},
  { method: 'GET',  path: '/api/armoriq/audit-trail',    desc: 'Full security audit log'           },
  { method: 'GET',  path: '/api/armoriq/policies',       desc: 'List active security policies'     },
  { method: 'POST', path: '/api/jailbreak',              desc: 'Submit request for processing'     },
  { method: 'GET',  path: '/api/tasks/{id}',             desc: 'Retrieve task status & results'    },
  { method: 'GET',  path: '/api/agents',                 desc: 'Get all agent statuses'            },
  { method: 'GET',  path: '/health',                     desc: 'Backend health check'              },
  { method: 'WS',   path: '/ws/updates',                 desc: 'Real-time WebSocket stream'        },
]

function Box({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: 10,
      border: '1px solid rgba(99,102,241,.15)',
      background: 'rgba(12,16,32,.85)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function ArrowDown() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
        <path d="M8 0v16M1 10l7 8 7-8" stroke="rgba(99,102,241,.4)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

export default function WorkflowVisualization({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>System Architecture</h2>
        <p style={{ margin: 0, fontSize: '.8rem', color: '#475569' }}>
          Complete technical overview of AgentForge — from user request to agent execution and real-time sync
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Left: Request flow */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 18px', fontSize: '.85rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Request Execution Flow
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* User */}
            <Box style={{ borderColor: 'rgba(6,182,212,.25)', background: 'rgba(6,182,212,.06)', textAlign: 'center' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#67e8f9' }}>User submits request</div>
              <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 2 }}>POST /api/jailbreak</div>
            </Box>
            <ArrowDown />

            {/* FastAPI */}
            <Box style={{ borderColor: 'rgba(99,102,241,.25)', background: 'rgba(99,102,241,.06)', textAlign: 'center' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#a5b4fc' }}>FastAPI Backend</div>
              <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 2 }}>Orchestrator analyzes request</div>
            </Box>
            <ArrowDown />

            {/* ArmorIQ dual row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Box style={{ borderColor: 'rgba(139,92,246,.25)', background: 'rgba(139,92,246,.06)' }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#c4b5fd' }}>ArmorIQ: capture_plan()</div>
                <div style={{ fontSize: '.68rem', color: '#475569', marginTop: 3, lineHeight: 1.4 }}>Builds intent hash + merkle root</div>
              </Box>
              <Box style={{ borderColor: 'rgba(139,92,246,.25)', background: 'rgba(139,92,246,.06)' }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#c4b5fd' }}>ArmorIQ: get_intent_token()</div>
                <div style={{ fontSize: '.68rem', color: '#475569', marginTop: 3, lineHeight: 1.4 }}>JWT signed, expires 60s</div>
              </Box>
            </div>
            <ArrowDown />

            {/* Policy check */}
            <Box style={{ borderColor: 'rgba(245,158,11,.25)', background: 'rgba(245,158,11,.06)', textAlign: 'center' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#fde68a' }}>Policy Enforcement</div>
              <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 2 }}>verify_action() — fail-closed security model</div>
            </Box>
            <ArrowDown />

            {/* Agent execution */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {['Analyzer', 'Executor', 'Validator', 'Reporter'].map((a, i) => (
                <Box key={a} style={{ borderColor: 'rgba(16,185,129,.2)', background: 'rgba(16,185,129,.05)', textAlign: 'center' }}>
                  <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#6ee7b7' }}>{a}</div>
                  <div style={{ fontSize: '.6rem', color: '#334155', marginTop: 2 }}>Step {i + 1}</div>
                </Box>
              ))}
            </div>
            <ArrowDown />

            {/* SpacetimeDB */}
            <Box style={{ borderColor: 'rgba(245,158,11,.25)', background: 'rgba(245,158,11,.06)', textAlign: 'center' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#fde68a' }}>SpacetimeDB</div>
              <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 2 }}>State persisted — WebSocket broadcasts to frontend</div>
            </Box>
          </div>
        </div>

        {/* Right: Panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Tech stack */}
          <div className="glass-card" style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '.85rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Technology Stack
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STACK.map(t => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#e2e8f0', flex: 1 }}>{t.label}</span>
                  <span style={{ fontSize: '.7rem', color: '#475569' }}>{t.sub}</span>
                  <span style={{ fontSize: '.65rem', padding: '2px 7px', borderRadius: 5, background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}25` }}>
                    {t.layer}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Security Policies */}
          <div className="glass-card" style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '.85rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              ArmorIQ Security Policies
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {POLICIES.map(p => (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: p.critical ? 'rgba(239,68,68,.05)' : 'rgba(12,16,32,.6)',
                  border: `1px solid ${p.color}25`,
                }}>
                  <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30`, flexShrink: 0 }}>
                    {p.action}
                  </span>
                  <span style={{ fontSize: '.78rem', color: '#94a3b8', flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: '.68rem', color: '#334155' }}>P{p.priority}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', fontSize: '.75rem', color: '#fca5a5' }}>
              Fail-closed by default — all actions BLOCKED unless explicitly allowed
            </div>
          </div>

          {/* Live task count mini-card */}
          {tasks.length > 0 && (
            <div className="glass-card" style={{ padding: 18 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '.85rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Live Session Stats
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Total', value: tasks.length, color: '#93c5fd' },
                  { label: 'Done',  value: tasks.filter(t => t.status === 'completed').length, color: '#6ee7b7' },
                  { label: 'Blocked', value: tasks.filter(t => t.status === 'blocked').length, color: '#fca5a5' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(12,16,32,.8)', borderRadius: 8, border: '1px solid rgba(99,102,241,.1)' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '.7rem', color: '#475569', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* API Reference */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '.85rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          API Reference — 10 Endpoints
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {ENDPOINTS.map(ep => {
            const methodColor: Record<string, string> = { GET: '#6ee7b7', POST: '#93c5fd', WS: '#c4b5fd' }
            return (
              <div key={ep.path} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(12,16,32,.7)', border: '1px solid rgba(99,102,241,.08)' }}>
                <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${methodColor[ep.method] ?? '#94a3b8'}15`, color: methodColor[ep.method] ?? '#94a3b8', flexShrink: 0, minWidth: 34, textAlign: 'center' }}>
                  {ep.method}
                </span>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.72rem', color: '#a5b4fc' }}>{ep.path}</div>
                  <div style={{ fontSize: '.7rem', color: '#475569', marginTop: 2 }}>{ep.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
