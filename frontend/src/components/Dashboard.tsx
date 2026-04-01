import { useState } from 'react'
import type { Task, Agent } from '../App'

const SAMPLE_REQUESTS = [
  'Analyze sales data from Q1 and generate a summary report',
  'Research competitor pricing and create a comparison matrix',
  'Review the codebase for security vulnerabilities',
]

function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, { path: string; color: string }> = {
    completed: { color: '#6ee7b7', path: 'M5 13l4 4L19 7' },
    blocked:   { color: '#fca5a5', path: 'M6 18L18 6M6 6l12 12' },
    processing:{ color: '#93c5fd', path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    error:     { color: '#fde68a', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    queued:    { color: '#c4b5fd', path: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  }
  const { color, path } = icons[status] ?? icons.queued
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

function TaskCard({ task }: { task: Task }) {
  const [open, setOpen] = useState(false)

  const borderMap: Record<string, string> = {
    completed: 'rgba(16,185,129,.25)',
    blocked:   'rgba(239,68,68,.25)',
    processing:'rgba(59,130,246,.25)',
    error:     'rgba(245,158,11,.25)',
    queued:    'rgba(99,102,241,.15)',
  }

  const badgeMap: Record<string, string> = {
    completed: 'badge-green',
    blocked:   'badge-red',
    processing:'badge-blue',
    error:     'badge-amber',
    queued:    'badge-purple',
  }

  return (
    <div
      onClick={() => setOpen(!open)}
      className="anim-fade-up"
      style={{
        padding: '16px 18px',
        borderRadius: 10,
        border: `1px solid ${borderMap[task.status] ?? borderMap.queued}`,
        background: 'rgba(12,16,32,.8)',
        cursor: 'pointer',
        transition: 'all .2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <StatusIcon status={task.status} />
            <span style={{ fontSize: '.7rem', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
              {task.id.slice(0, 8)}...
            </span>
            <span style={{ fontSize: '.7rem', color: '#334155' }}>
              {new Date(task.created_at).toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
          <p className="line-clamp-2" style={{ margin: 0, fontSize: '.875rem', color: '#e2e8f0', fontWeight: 500 }}>
            {task.user_request}
          </p>
          <div className="progress-bar-track" style={{ marginTop: 10 }}>
            <div
              className={`progress-bar-fill${task.status === 'processing' ? ' animated' : ''}`}
              style={{ width: `${task.progress || 0}%` }}
            />
          </div>
          <span style={{ fontSize: '.68rem', color: '#475569', marginTop: 4, display: 'block' }}>
            {Math.round(task.progress || 0)}% complete
          </span>
        </div>
        <span className={`badge ${badgeMap[task.status] ?? 'badge-slate'}`} style={{ flexShrink: 0 }}>
          {task.status}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(99,102,241,.1)', fontSize: '.8rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {task.plan_id && (
            <div>
              <span style={{ color: '#475569', marginRight: 8 }}>Plan ID:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{task.plan_id}</span>
            </div>
          )}
          {task.blocked_reason && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6 }}>
              <span style={{ color: '#f87171', fontWeight: 600 }}>Blocked: </span>
              <span style={{ color: '#fca5a5' }}>{task.blocked_reason}</span>
            </div>
          )}
          <div>
            <span style={{ color: '#475569', marginRight: 8 }}>ArmorIQ Verification:</span>
            <span className="badge badge-green">Cryptographic JWT</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({
  tasks,
  agents,
  onTaskSubmit,
  onTaskCreated,
}: {
  tasks: Task[]
  agents: Agent[]
  onTaskSubmit: () => void
  onTaskCreated: (task: Task) => void
}) {
  const [userRequest, setUserRequest] = useState('')
  const [context,     setContext]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userRequest.trim()) return
    setSubmitting(true)
    setError('')
    setSuccess(false)

    // Guard against empty-string JSON.parse crash
    let parsedContext: Record<string, unknown> = {}
    if (context.trim()) {
      try { parsedContext = JSON.parse(context) }
      catch { setError('Context must be valid JSON'); setSubmitting(false); return }
    }

    try {
      const res = await fetch('/api/jailbreak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_request: userRequest, context: parsedContext }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Immediately show task in Task History
      onTaskCreated({
        id: data.task_id,
        user_request: userRequest,
        status: data.status ?? 'queued',
        plan_id: data.plan_id,
        blocked_reason: data.blocked_reason,
        created_at: new Date().toISOString(),
        progress: 0,
      })
      setUserRequest('')
      setContext('')
      setSuccess(true)
      onTaskSubmit()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

      {/* Left: Submit Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>Submit Request</h2>
            <p style={{ margin: 0, fontSize: '.8rem', color: '#475569' }}>
              Requests are verified by ArmorIQ before multi-agent execution
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                User Request
              </label>
              <textarea
                value={userRequest}
                onChange={e => setUserRequest(e.target.value)}
                rows={5}
                style={{ width: '100%', padding: '12px 14px', resize: 'vertical', fontSize: '.875rem', lineHeight: 1.6 }}
                placeholder="Describe what you want the agents to do..."
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: '.7rem', color: '#334155' }}>{userRequest.length} characters</span>
              </div>
            </div>

            {/* Sample requests */}
            <div>
              <span style={{ fontSize: '.7rem', color: '#475569', display: 'block', marginBottom: 6 }}>SAMPLE REQUESTS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {SAMPLE_REQUESTS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setUserRequest(r)}
                    style={{
                      background: 'rgba(99,102,241,.07)',
                      border: '1px solid rgba(99,102,241,.15)',
                      borderRadius: 6,
                      padding: '7px 12px',
                      color: '#7c86a8',
                      fontSize: '.78rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                    onMouseOver={e => (e.currentTarget.style.color = '#a5b4fc')}
                    onMouseOut={e => (e.currentTarget.style.color = '#7c86a8')}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                Context — optional JSON
              </label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '10px 14px', fontSize: '.8rem', fontFamily: 'JetBrains Mono, monospace', resize: 'none' }}
                placeholder='{"department": "sales", "timeframe": "Q1"}'
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, fontSize: '.825rem', color: '#fca5a5' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, fontSize: '.825rem', color: '#6ee7b7' }}>
                Request submitted — agents are processing
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={submitting || !userRequest.trim()}>
              {submitting ? (
                <>
                  <svg className="spin-slow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".3"/>
                    <path d="M12 3a9 9 0 019 9"/>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Submit to AgentForge
                </>
              )}
            </button>
          </form>
        </div>

        {/* System info */}
        <div className="glass-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '.875rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            System Configuration
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'LLM Engine',          value: 'Ollama / Mistral',          ok: true },
              { label: 'Security Layer',       value: 'ArmorIQ Intent Verify',      ok: true },
              { label: 'Database',             value: 'SpacetimeDB (real-time)',    ok: true },
              { label: 'API Endpoints',        value: '11 REST + WebSocket',        ok: true },
              { label: 'Agents Available',     value: `${agents.length} agents`,   ok: agents.length > 0 },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.82rem' }}>
                <span style={{ color: '#64748b' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: row.ok ? '#10b981' : '#ef4444' }} />
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>{row.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Task history */}
      <div className="glass-card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: 700 }}>Task History</h2>
            <p style={{ margin: 0, fontSize: '.78rem', color: '#475569' }}>Click a task to expand details</p>
          </div>
          <span className="badge badge-slate">{tasks.length} tasks</span>
        </div>

        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <p style={{ color: '#475569', margin: 0, fontSize: '.9rem', fontWeight: 500 }}>No tasks yet</p>
            <p style={{ color: '#334155', margin: '4px 0 0', fontSize: '.8rem' }}>Submit a request to see agent execution here</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 620, overflowY: 'auto', paddingRight: 4 }}>
            {tasks.map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        )}
      </div>
    </div>
  )
}
