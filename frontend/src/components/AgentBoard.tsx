import React, { useState } from 'react'
import type { Agent, LogEntry } from '../App'


const AGENT_META: Record<string, { icon: string; role: string; color: string; desc: string; provider: 'ollama' | 'gemini'; model: string; order: number }> = {
  analyzer: {
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    role: 'Request Analyzer',
    color: '#3b82f6',
    provider: 'ollama',
    model: 'mistral',
    order: 1,
    desc: 'Fast local analysis using Ollama (Mistral) — breaks down requests into actionable steps',
  },
  executor: {
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    role: 'Action Executor',
    color: '#10b981',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    order: 2,
    desc: 'Accurate execution using Gemini Flash — performs approved actions with high precision',
  },
  validator: {
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    role: 'Result Validator',
    color: '#8b5cf6',
    provider: 'ollama',
    model: 'mistral',
    order: 3,
    desc: 'Fast verification using Ollama (Mistral) — validates results for correctness & compliance',
  },
  reporter: {
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    role: 'Report Generator',
    color: '#f59e0b',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    order: 4,
    desc: 'Accurate reporting using Gemini Flash — generates clear, structured final reports',
  },
}

// Sequential agent execution order
const AGENT_EXECUTION_ORDER = ['analyzer', 'executor', 'validator', 'reporter']

function AgentIcon({ path, color }: { path: string; color: string }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 12,
      background: `${color}15`,
      border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </div>
  )
}

function AgentCard({ agent, sessionId, logs = [] }: { agent: Agent; sessionId: string; logs?: LogEntry[] }) {
  const [logsOpen, setLogsOpen] = useState(false)
  const meta = AGENT_META[agent.name.toLowerCase()] ?? AGENT_META.analyzer
  const isWorking = agent.status === 'working'
  const isError   = agent.status === 'error'

  // Filter logs for this agent
  const agentLogs = logs.filter(log =>
    log.message.toLowerCase().includes(agent.name.toLowerCase()) ||
    log.message.includes(`[${agent.name}]`)
  ).slice(0, 5)

  return (
    <div className={`agent-card${isWorking ? ' working' : ''} anim-fade-up`} style={{
      position: 'relative',
      overflow: 'visible',
    }}>
      {/* Glow line at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: isWorking
          ? `linear-gradient(90deg, transparent, ${meta.color}, transparent)`
          : isError ? 'linear-gradient(90deg, transparent, #ef4444, transparent)' : 'transparent',
        transition: 'background .5s',
      }} />

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <AgentIcon path={meta.icon} color={isError ? '#ef4444' : meta.color} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontSize: '.95rem', fontWeight: 700, textTransform: 'capitalize' }}>
                {agent.name}
              </h3>
              <p style={{ margin: 0, fontSize: '.75rem', color: '#64748b' }}>{meta.role}</p>
            </div>
            <span className={`badge ${isWorking ? 'badge-green' : isError ? 'badge-red' : 'badge-slate'}`}>
              {isWorking ? '⚙ Working' : isError ? '❌ Error' : '✓ Idle'}
            </span>
          </div>
        </div>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '.8rem', color: '#475569', lineHeight: 1.55 }}>
        {meta.desc}
      </p>

      {/* Provider & Model Badge */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <span style={{
          padding: '4px 10px',
          fontSize: '.7rem',
          fontWeight: 700,
          background: meta.provider === 'gemini' ? 'rgba(34,197,94,.1)' : 'rgba(59,130,246,.1)',
          border: `1px solid ${meta.provider === 'gemini' ? 'rgba(34,197,94,.25)' : 'rgba(59,130,246,.25)'}`,
          borderRadius: 6,
          color: meta.provider === 'gemini' ? '#6ee7b7' : '#60a5fa',
          textTransform: 'capitalize',
        }}>
          🔌 {meta.provider === 'gemini' ? 'Gemini Flash' : 'Ollama'}
        </span>
        <span style={{
          padding: '4px 10px',
          fontSize: '.7rem',
          fontWeight: 600,
          background: `${meta.color}10`,
          border: `1px solid ${meta.color}25`,
          borderRadius: 6,
          color: meta.color,
        }}>
          📦 {meta.model}
        </span>
      </div>

      {/* Capabilities */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {(agent.capabilities?.length > 0
          ? agent.capabilities
          : ['Analysis', 'Planning', 'Verification']
        ).slice(0, 3).map(cap => (
          <span key={cap} style={{
            padding: '3px 8px',
            fontSize: '.65rem',
            fontWeight: 600,
            background: `${meta.color}15`,
            border: `1px solid ${meta.color}30`,
            borderRadius: 6,
            color: meta.color,
            textTransform: 'capitalize',
          }}>
            {cap.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Live Logs Section */}
      {agentLogs.length > 0 && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(30,41,59,.5)',
          border: `1px solid ${meta.color}20`,
          borderRadius: 8,
          marginBottom: 12,
        }}>
          <button
            onClick={() => setLogsOpen(!logsOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              textAlign: 'left',
              transition: 'color .2s',
            }}
            onMouseOver={e => (e.currentTarget.style.color = meta.color)}
            onMouseOut={e => (e.currentTarget.style.color = '#94a3b8')}
          >
            <span>{logsOpen ? '▼' : '▶'}</span>
            <span>📋 Live Logs ({agentLogs.length})</span>
          </button>
          {logsOpen && (
            <div style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${meta.color}20`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              maxHeight: 150,
              overflowY: 'auto',
            }}>
              {agentLogs.map((log, i) => (
                <div key={i} style={{
                  fontSize: '.7rem',
                  color: log.type === 'error' ? '#fca5a5' : log.type === 'success' ? '#6ee7b7' : '#94a3b8',
                  fontFamily: 'JetBrains Mono, monospace',
                  lineHeight: 1.4,
                  paddingLeft: 4,
                  borderLeft: `2px solid ${log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : meta.color}`,
                }}>
                  {log.type === 'error' && '❌ '}
                  {log.type === 'success' && '✓ '}
                  {log.type === 'warning' && '⚠ '}
                  {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTop: '1px solid rgba(99,102,241,.08)',
        fontSize: '.7rem',
      }}>
        <div style={{ color: '#475569' }}>
          Executions: <span style={{ color: '#94a3b8', fontWeight: 700 }}>{agent.execution_count ?? 0}</span>
        </div>
        {agent.last_task_id && (
          <div style={{ color: '#475569' }}>
            Last: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
              {agent.last_task_id.slice(0, 6)}...
            </span>
          </div>
        )}
      </div>

      {/* Working animation bar */}
      {isWorking && (
        <div style={{ marginTop: 12 }}>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill animated"
              style={{ width: '100%', '--bar-color': meta.color } as React.CSSProperties}
            />
          </div>
          {agent.current_task_user_id && (
            <div style={{ fontSize: '.7rem', color: meta.color, marginTop: 8, fontWeight: 500 }}>
              👤 User: <span style={{ color: agent.current_task_user_id === sessionId ? '#818cf8' : '#94a3b8' }}>
                {agent.current_task_user_id === sessionId ? 'you' : agent.current_task_user_id.slice(0, 6)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Fallback mock agents for demo when backend is offline
const MOCK_AGENTS: Agent[] = [
  { id: 'agent-001', name: 'Analyzer', role: 'Request Analyzer', status: 'idle', execution_count: 0, capabilities: ['request_analysis', 'context_evaluation', 'requirement_breakdown'], llm_provider: 'ollama', model: 'mistral' },
  { id: 'agent-002', name: 'Executor', role: 'Action Executor',  status: 'idle', execution_count: 0, capabilities: ['action_execution', 'api_calling', 'task_orchestration'], llm_provider: 'gemini', model: 'gemini-2.5-flash' },
  { id: 'agent-003', name: 'Validator',role: 'Result Validator', status: 'idle', execution_count: 0, capabilities: ['result_validation', 'security_checks', 'compliance_verification'], llm_provider: 'ollama', model: 'mistral' },
  { id: 'agent-004', name: 'Reporter', role: 'Report Generator', status: 'idle', execution_count: 0, capabilities: ['result_formatting', 'report_generation', 'summary_creation'], llm_provider: 'gemini', model: 'gemini-2.5-flash' },
]

interface AgentBoardProps {
  agents: Agent[]
  sessionId?: string
  logs?: any[]
  tasks?: any[]
}

export default function AgentBoard({ agents, sessionId, logs = [], tasks = [] }: AgentBoardProps) {
  const display = agents.length > 0 ? agents : MOCK_AGENTS
  const working = display.filter(a => a.status === 'working').length
  const idle    = display.filter(a => a.status === 'idle').length
  const error   = display.filter(a => a.status === 'error').length
  const sid = sessionId || 'anonymous'

  // Find which agent should be next in the pipeline
  const getAgentIndex = (agentName: string) => {
    return AGENT_EXECUTION_ORDER.findIndex(name => name === agentName.toLowerCase())
  }

  // Sort agents by execution order
  const sortedAgents = [...display].sort((a, b) => {
    const aIdx = getAgentIndex(a.name)
    const bIdx = getAgentIndex(b.name)
    return aIdx - bIdx
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header with stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>Agent Execution Pipeline</h2>
          <p style={{ margin: 0, fontSize: '.8rem', color: '#475569' }}>
            4-agent sequential pipeline: Analyzer → Executor → Validator → Reporter
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {working > 0 && <span className="badge badge-green">⚙ {working} working</span>}
          {idle > 0 && <span className="badge badge-slate">✓ {idle} idle</span>}
          {error > 0 && <span className="badge badge-red">❌ {error} error</span>}
        </div>
      </div>

      {/* Pipeline execution flow */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 18px',
        background: 'rgba(12,16,32,.9)',
        border: '1px solid rgba(99,102,241,.15)',
        borderRadius: 12,
        overflowX: 'auto',
        minHeight: 60,
      }}>
        {sortedAgents.map((agent, idx) => {
          const meta = AGENT_META[agent.name.toLowerCase()]
          const isWorking = agent.status === 'working'
          const isError = agent.status === 'error'
          const isDone = agent.status === 'idle' && agent.execution_count > 0

          return (
            <React.Fragment key={agent.id}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}>
                {/* Step number */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: isError ? 'rgba(239,68,68,.2)' : isWorking ? `${meta.color}25` : isDone ? `${meta.color}15` : 'rgba(30,41,59,.5)',
                  border: `2px solid ${isError ? '#ef4444' : isWorking ? meta.color : isDone ? meta.color : '#334155'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '.85rem',
                  fontWeight: 700,
                  color: isError ? '#fca5a5' : isWorking ? meta.color : isDone ? meta.color : '#475569',
                  boxShadow: isWorking ? `0 0 12px ${meta.color}40` : 'none',
                }}>
                  {isError ? '❌' : isWorking ? '⚙' : isDone ? '✓' : idx + 1}
                </div>
                <span style={{
                  fontSize: '.65rem',
                  fontWeight: 700,
                  color: isError ? '#fca5a5' : isWorking ? meta.color : isDone ? meta.color : '#475569',
                  textTransform: 'capitalize',
                }}>
                  {agent.name}
                </span>
              </div>

              {/* Arrow between agents */}
              {idx < sortedAgents.length - 1 && (
                <svg width="28" height="2" viewBox="0 0 28 2" fill="none" style={{ flexShrink: 0 }}>
                  <line
                    x1="2" y1="1" x2="24" y2="1"
                    stroke={sortedAgents[idx].status !== 'idle' || (sortedAgents[idx].status === 'idle' && sortedAgents[idx].execution_count > 0) ? '#10b981' : '#334155'}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <polygon
                    points="26,1 22,0 22,2"
                    fill={sortedAgents[idx].status !== 'idle' || (sortedAgents[idx].status === 'idle' && sortedAgents[idx].execution_count > 0) ? '#10b981' : '#334155'}
                  />
                </svg>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Agent cards grid in execution order */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {sortedAgents.map((agent, idx) => {
          const agentLogs = logs.filter((log: any) =>
            log.message?.toLowerCase().includes(agent.name.toLowerCase()) ||
            log.message?.includes(`[${agent.name}]`)
          )

          return (
            <div key={agent.id} style={{ position: 'relative' }}>
              {/* Step number indicator */}
              <div style={{
                position: 'absolute',
                top: -10,
                left: 12,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(12,16,32,1)',
                border: '2px solid rgba(99,102,241,.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '.75rem',
                fontWeight: 700,
                color: '#6366f1',
                zIndex: 10,
              }}>
                {idx + 1}
              </div>
              <AgentCard agent={agent} sessionId={sid} logs={agentLogs} />
            </div>
          )
        })}
      </div>

      {/* Info section */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(99,102,241,.08)',
        border: '1px solid rgba(99,102,241,.15)',
        borderRadius: 8,
        fontSize: '.75rem',
        color: '#94a3b8',
        lineHeight: 1.5,
      }}>
        <strong style={{ color: '#a5b4fc' }}>📌 Execution Flow:</strong> Agents execute sequentially — each agent waits for the previous one to complete before starting.
        All operations are verified by ArmorIQ before execution begins.
      </div>

      {agents.length === 0 && (
        <div style={{ textAlign: 'center', fontSize: '.8rem', color: '#334155', paddingTop: 12 }}>
          Showing demo data — connect backend to see live agent execution
        </div>
      )}
    </div>
  )
}
