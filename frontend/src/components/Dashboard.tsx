import { useState } from 'react'
import type { Task, Agent, UserRole, RBACJudgment } from '../App'

const BACKEND_HTTP = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8001'

function getStepName(progress: number, status: string): string {
  if (status === 'completed') return 'SpacetimeDB Sync'
  if (status === 'blocked') return 'Policy Enforcement'
  if (status === 'error') return 'Error'
  if (status === 'queued') return 'Queued'
  if (progress < 25) return 'Intent Classifier'
  if (progress < 50) return 'Executor (Gemini)'
  if (progress < 75) return 'Validator (Ollama)'
  if (progress < 100) return 'Reporter (Gemini)'
  return 'Finalizing'
}

const RISK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  low: { color: '#6ee7b7', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.2)' },
  medium: { color: '#fde68a', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' },
  high: { color: '#fb923c', bg: 'rgba(249,115,22,.1)', border: 'rgba(249,115,22,.2)' },
  critical: { color: '#f87171', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.2)' },
}

const POLICY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  allow: { color: '#6ee7b7', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.2)' },
  block: { color: '#f87171', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.2)' },
  require_approval: { color: '#fde68a', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' },
}

const SAMPLE_REQUESTS = [
  'Analyze sales data from Q1 and generate a summary report',
  'Delete the old config file from the project',
  'Drop the staging database and reset it',
  'Deploy the latest build to production',
]

function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, { path: string; color: string }> = {
    completed: { color: '#6ee7b7', path: 'M5 13l4 4L19 7' },
    blocked: { color: '#fca5a5', path: 'M6 18L18 6M6 6l12 12' },
    processing: { color: '#93c5fd', path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    error: { color: '#fde68a', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    queued: { color: '#c4b5fd', path: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  }
  const { color, path } = icons[status] ?? icons.queued
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

function JudgmentPanel({ judgment }: { judgment: RBACJudgment }) {
  const risk = RISK_COLORS[judgment.risk_level] ?? RISK_COLORS.medium
  const policy = POLICY_COLORS[judgment.policy_action] ?? POLICY_COLORS.block

  return (
    <div style={{
      marginTop: 14, padding: 14,
      background: 'rgba(6,9,20,.6)',
      border: `1px solid ${policy.border}`,
      borderRadius: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={policy.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span style={{ fontSize: '.72rem', fontWeight: 700, color: policy.color, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          ArmorIQ RBAC Judgment
        </span>
      </div>

      {/* Grid: intent + role + risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ padding: '8px 10px', background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 6 }}>
          <div style={{ fontSize: '.6rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Detected Intent</div>
          <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#c4b5fd' }}>{judgment.intent_category.replace(/_/g, ' ')}</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 6 }}>
          <div style={{ fontSize: '.6rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Role</div>
          <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#a5b4fc' }}>{judgment.role.replace(/_/g, ' ')}</div>
        </div>
        <div style={{ padding: '8px 10px', background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 6 }}>
          <div style={{ fontSize: '.6rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Risk Level</div>
          <div style={{ fontSize: '.75rem', fontWeight: 600, color: risk.color }}>{judgment.risk_level}</div>
        </div>
      </div>

      {/* What the user wants */}
      <div style={{ marginBottom: 8, padding: '7px 10px', background: 'rgba(15,23,42,.5)', borderRadius: 6, fontSize: '.78rem', color: '#94a3b8' }}>
        <span style={{ color: '#475569', fontWeight: 600 }}>Intent: </span>{judgment.intent_description}
      </div>

      {/* Decision */}
      <div style={{ padding: '8px 12px', background: policy.bg, border: `1px solid ${policy.border}`, borderRadius: 6, fontSize: '.8rem', color: policy.color, fontWeight: 600 }}>
        {judgment.judgment_reason}
      </div>

      {judgment.requires_approval_from && (
        <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 6, fontSize: '.75rem', color: '#fde68a' }}>
          📋 Approval required from: <strong>{judgment.requires_approval_from}</strong>
        </div>
      )}
    </div>
  )
}

function AgentReport({ report }: { report: string }) {
  const [expanded, setExpanded] = useState(false)
  const lines = report.split('\n').filter(Boolean)
  const preview = lines.slice(0, 4).join('\n')
  const needsToggle = lines.length > 4

  return (
    <div style={{
      marginTop: 10,
      border: '1px solid rgba(16,185,129,.2)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'rgba(16,185,129,.06)',
        borderBottom: '1px solid rgba(16,185,129,.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#6ee7b7', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Final Agent Report
          </span>
          <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 999, background: 'rgba(16,185,129,.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,.2)' }}>
            Reporter (Gemini)
          </span>
        </div>
        {needsToggle && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: '.7rem', fontWeight: 600 }}
          >
            {expanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        )}
      </div>
      <div style={{
        padding: '12px 14px',
        background: 'rgba(6,9,20,.8)',
        fontSize: '.78rem',
        color: '#94a3b8',
        fontFamily: 'JetBrains Mono, monospace',
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        maxHeight: expanded ? 'none' : '120px',
        overflow: 'hidden',
      }}>
        {expanded ? report : preview}
        {!expanded && needsToggle && (
          <span style={{ color: '#475569' }}> …</span>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, isOwn, sessionId }: { task: Task; isOwn: boolean; sessionId: string }) {
  const [open, setOpen] = useState(false)

  const borderMap: Record<string, string> = {
    completed: 'rgba(16,185,129,.25)',
    blocked: 'rgba(239,68,68,.25)',
    processing: 'rgba(59,130,246,.25)',
    error: 'rgba(239,68,68,.25)',
    queued: 'rgba(99,102,241,.15)',
  }
  const badgeMap: Record<string, string> = {
    completed: 'badge-green',
    blocked: 'badge-red',
    processing: 'badge-blue',
    error: 'badge-red',
    queued: 'badge-purple',
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
            {task.role && (
              <span style={{
                fontSize: '.6rem', padding: '2px 7px', borderRadius: 999,
                background: 'rgba(139,92,246,.12)', color: '#a78bfa',
                border: '1px solid rgba(139,92,246,.2)',
              }}>
                {task.role.replace(/_/g, ' ')}
              </span>
            )}
            <span style={{
              fontSize: '.65rem', padding: '2px 7px', borderRadius: 999,
              background: isOwn ? 'rgba(99,102,241,.15)' : 'rgba(148,163,184,.08)',
              color: isOwn ? '#a5b4fc' : '#64748b',
              border: `1px solid ${isOwn ? 'rgba(99,102,241,.25)' : 'rgba(148,163,184,.12)'}`,
            }}>
              {isOwn ? 'You' : `User ${task.user_id?.slice(0, 6) ?? '?'}`}
            </span>
          </div>
          <p className="line-clamp-2" style={{ margin: 0, fontSize: '.875rem', color: '#e2e8f0', fontWeight: 500 }}>
            {task.user_request}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            <div className="progress-bar-track">
              <div
                className={`progress-bar-fill${task.status === 'processing' ? ' animated' : ''}`}
                style={{ width: `${task.progress || 0}%`, transition: 'width 0.3s ease' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '.68rem', color: '#475569' }}>
                {getStepName(task.progress || 0, task.status)} • {Math.round(task.progress || 0)}%
              </span>
              {task.status === 'processing' && (
                <span style={{ fontSize: '.6rem', color: '#6366f1', animation: 'pulse 1s infinite' }}>● Running</span>
              )}
            </div>
          </div>
        </div>
        <span className={`badge ${badgeMap[task.status] ?? 'badge-slate'}`} style={{ flexShrink: 0 }}>
          {task.status}
        </span>
      </div>

      {open && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(99,102,241,.1)', fontSize: '.8rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {task.plan_id && (
            <div>
              <span style={{ color: '#475569', marginRight: 8 }}>Plan ID:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{task.plan_id}</span>
            </div>
          )}

          {/* RBAC Judgment */}
          {task.judgment && <JudgmentPanel judgment={task.judgment} />}

          {/* Blocked reason (non-judgment blocks) */}
          {task.blocked_reason && !task.judgment && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6 }}>
              <span style={{ color: '#f87171', fontWeight: 600 }}>
                {task.status === 'error' ? '❌ Error: ' : '🔒 Blocked: '}
              </span>
              <span style={{ color: '#fca5a5', fontFamily: 'JetBrains Mono, monospace', fontSize: '.75rem' }}>
                {task.blocked_reason}
              </span>
            </div>
          )}

          {/* Final agent report */}
          {task.report && task.status === 'completed' && (
            <AgentReport report={task.report} />
          )}

          {task.status !== 'blocked' && task.status !== 'error' && !task.judgment && (
            <div>
              <span style={{ color: '#475569', marginRight: 8 }}>ArmorIQ Verification:</span>
              <span className="badge badge-green">Cryptographic JWT</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard({
  tasks,
  agents,
  sessionId,
  liveUsers,
  role,
  onTaskSubmit,
  onTaskCreated,
}: {
  tasks: Task[]
  agents: Agent[]
  sessionId: string
  liveUsers: number
  role: UserRole
  onTaskSubmit: () => void
  onTaskCreated: (task: Task) => void
}) {
  const [userRequest, setUserRequest] = useState('')
  const [context, setContext] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userRequest.trim()) return
    setSubmitting(true)
    setError('')
    setSuccess(false)

    let parsedContext: Record<string, unknown> = {}
    if (context.trim()) {
      try { parsedContext = JSON.parse(context) }
      catch { setError('Context must be valid JSON'); setSubmitting(false); return }
    }

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/jailbreak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_request: userRequest,
          context: parsedContext,
          user_id: sessionId,
          role,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      onTaskCreated({
        id: data.task_id,
        user_request: userRequest,
        status: data.status ?? 'queued',
        plan_id: data.plan_id,
        blocked_reason: data.blocked_reason,
        created_at: new Date().toISOString(),
        progress: 0,
        user_id: sessionId,
        role,
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
              Submitting as <strong style={{ color: '#a5b4fc' }}>{role.replace(/_/g, ' ')}</strong> — ArmorIQ + Analyzer will judge intent before execution
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
                Request submitted as <strong>{role.replace(/_/g, ' ')}</strong> — agents are processing
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={submitting || !userRequest.trim()}>
              {submitting ? (
                <>
                  <svg className="spin-slow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".3" />
                    <path d="M12 3a9 9 0 019 9" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Submit as {role.replace(/_/g, ' ')}
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
              { label: 'LLM Engine', value: 'Ollama / Mistral', ok: true },
              { label: 'Security Layer', value: 'ArmorIQ Intent Verify', ok: true },
              { label: 'RBAC Enforcement', value: 'Analyzer + ArmorIQ', ok: true },
              { label: 'Database', value: 'SpacetimeDB (real-time)', ok: true },
              { label: 'Active Role', value: role.replace(/_/g, ' '), ok: true },
              { label: 'Agents Available', value: `${agents.length} agents`, ok: agents.length > 0 },
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
            <p style={{ margin: 0, fontSize: '.78rem', color: '#475569' }}>Click a task to see judgment + final report</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-slate">{tasks.length} tasks</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', color: '#34d399' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399' }} />
              {liveUsers} live
            </span>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p style={{ color: '#475569', margin: 0, fontSize: '.9rem', fontWeight: 500 }}>No tasks yet</p>
            <p style={{ color: '#334155', margin: '4px 0 0', fontSize: '.8rem' }}>Submit a request to see agent execution here</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 680, overflowY: 'auto', paddingRight: 4 }}>
            {(() => {
              const myTasks = tasks.filter(t => t.user_id === sessionId)
              const otherTasks = tasks.filter(t => t.user_id && t.user_id !== sessionId)
              return <>
                {myTasks.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: '.7rem', color: '#6366f1', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                      My Tasks ({myTasks.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {myTasks.map(task => <TaskCard key={task.id} task={task} isOwn={true} sessionId={sessionId} />)}
                    </div>
                  </div>
                )}
                {otherTasks.length > 0 && (
                  <div>
                    <div style={{ fontSize: '.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Other Users ({otherTasks.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {otherTasks.map(task => <TaskCard key={task.id} task={task} isOwn={false} sessionId={sessionId} />)}
                    </div>
                  </div>
                )}
              </>
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
