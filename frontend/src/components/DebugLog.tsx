import { useState, useRef, useEffect } from 'react'
import type { LogEntry } from '../App'

const TYPE_CONFIG: Record<LogEntry['type'], { label: string; color: string; bg: string }> = {
  info:     { label: 'INFO',     color: '#93c5fd', bg: 'rgba(59,130,246,.08)'   },
  success:  { label: 'OK',       color: '#6ee7b7', bg: 'rgba(16,185,129,.08)'   },
  error:    { label: 'ERR',      color: '#fca5a5', bg: 'rgba(239,68,68,.08)'    },
  warning:  { label: 'WARN',     color: '#fde68a', bg: 'rgba(245,158,11,.08)'   },
  security: { label: 'SEC',      color: '#c4b5fd', bg: 'rgba(139,92,246,.08)'   },
}

const FILTERS = ['all', 'info', 'success', 'error', 'warning', 'security'] as const
type Filter = typeof FILTERS[number]

// Sample log for when no real logs exist yet
const SAMPLE_LOGS: LogEntry[] = [
  { timestamp: '00:00:01', type: 'info',     message: 'AgentForge backend service started on port 8000' },
  { timestamp: '00:00:01', type: 'success',  message: 'ArmorIQ SDK initialized — intent verification active' },
  { timestamp: '00:00:01', type: 'info',     message: 'SpacetimeDB connection established — real-time sync ready' },
  { timestamp: '00:00:02', type: 'info',     message: 'Ollama LLM engine loaded (mistral model)' },
  { timestamp: '00:00:02', type: 'success',  message: '4 agents registered: Analyzer, Executor, Validator, Reporter' },
  { timestamp: '00:00:03', type: 'security', message: 'Security policies loaded: Allow Analysis, Allow Execution, Block Dangerous, Require Approval' },
]

export default function DebugLog({ logs }: { logs: LogEntry[] }) {
  const [filter, setFilter]     = useState<Filter>('all')
  const [search, setSearch]     = useState('')
  const [autoscroll, setAutoscroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const display = logs.length > 0 ? logs : SAMPLE_LOGS

  const filtered = display.filter(l => {
    const matchFilter = filter === 'all' || l.type === filter
    const matchSearch = !search || l.message.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  useEffect(() => {
    if (autoscroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filtered.length, autoscroll])

  const counts: Record<string, number> = { all: display.length }
  display.forEach(l => { counts[l.type] = (counts[l.type] ?? 0) + 1 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>Live System Logs</h2>
          <p style={{ margin: 0, fontSize: '.8rem', color: '#475569' }}>
            Real-time event stream from backend, ArmorIQ verification, and agent execution
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', position: 'absolute', top: 10, left: 10, animation: 'pulse-ring 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '.75rem', color: '#6ee7b7', fontWeight: 600, paddingLeft: 24 }}>Live</span>
          </div>
          <span className="badge badge-slate">{display.length} entries</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', fontSize: '.82rem', borderRadius: 8 }}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 5 }}>
          {FILTERS.map(f => {
            const cfg = f === 'all' ? null : TYPE_CONFIG[f]
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 12px',
                  fontSize: '.72rem',
                  fontWeight: 600,
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  borderRadius: 7,
                  border: `1px solid ${active ? (cfg?.color ?? '#6366f1') + '60' : 'rgba(99,102,241,.12)'}`,
                  background: active ? (cfg?.bg ?? 'rgba(99,102,241,.1)') : 'transparent',
                  color: active ? (cfg?.color ?? '#a5b4fc') : '#475569',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                {f} {counts[f] !== undefined ? `(${counts[f]})` : ''}
              </button>
            )
          })}
        </div>

        {/* Autoscroll toggle */}
        <button
          onClick={() => setAutoscroll(!autoscroll)}
          style={{
            padding: '6px 12px',
            fontSize: '.72rem',
            fontWeight: 600,
            borderRadius: 7,
            border: `1px solid ${autoscroll ? 'rgba(16,185,129,.3)' : 'rgba(99,102,241,.12)'}`,
            background: autoscroll ? 'rgba(16,185,129,.1)' : 'transparent',
            color: autoscroll ? '#6ee7b7' : '#475569',
            cursor: 'pointer',
            transition: 'all .15s',
          }}
        >
          {autoscroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
        </button>
      </div>

      {/* Log window */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Terminal toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(99,102,241,.1)',
          background: 'rgba(8,11,22,.6)',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
          <span style={{ marginLeft: 10, fontSize: '.75rem', color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>
            agentforge — system log
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '.7rem', color: '#1e293b' }}>
            {filtered.length} / {display.length} shown
          </span>
        </div>

        {/* Log entries */}
        <div style={{ height: 520, overflowY: 'auto', padding: '10px 6px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155', fontSize: '.85rem' }}>
              No matching log entries
            </div>
          ) : (
            [...filtered].reverse().map((log, i) => {
              const cfg = TYPE_CONFIG[log.type]
              return (
                <div
                  key={i}
                  className="log-line"
                  style={{ background: i % 2 === 0 ? 'rgba(12,16,32,.3)' : 'transparent' }}
                >
                  <span className="ts">{log.timestamp}</span>
                  <span style={{
                    fontSize: '.65rem',
                    fontWeight: 700,
                    letterSpacing: '.06em',
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: cfg.bg,
                    color: cfg.color,
                    flexShrink: 0,
                    border: `1px solid ${cfg.color}30`,
                    minWidth: 38,
                    textAlign: 'center',
                  }}>
                    {cfg.label}
                  </span>
                  <span style={{ color: '#94a3b8', flex: 1 }}>{log.message}</span>
                  {log.task_id && log.task_id !== 'system' && (
                    <span style={{ fontSize: '.65rem', fontFamily: 'JetBrains Mono, monospace', color: '#334155', flexShrink: 0 }}>
                      #{log.task_id.slice(0, 8)}
                    </span>
                  )}
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {logs.length === 0 && (
        <div style={{ textAlign: 'center', fontSize: '.78rem', color: '#334155' }}>
          Showing sample logs — connect backend to stream live events
        </div>
      )}
    </div>
  )
}
