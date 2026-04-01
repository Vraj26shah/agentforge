import React from 'react'
import type { Agent } from '../App'


const AGENT_META: Record<string, { icon: string; role: string; color: string; desc: string; provider?: string }> = {
  analyzer: {
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    role: 'Request Analyzer',
    color: '#3b82f6',
    provider: 'ollama',
    desc: 'Fast local analysis using Ollama (Mistral) — breaks down requests into actionable steps',
  },
  executor: {
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    role: 'Action Executor',
    color: '#10b981',
    provider: 'gemini',
    desc: 'Accurate execution using Gemini Flash — performs approved actions with high precision',
  },
  validator: {
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    role: 'Result Validator',
    color: '#8b5cf6',
    provider: 'ollama',
    desc: 'Fast verification using Ollama (Mistral) — validates results for correctness & compliance',
  },
  reporter: {
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    role: 'Report Generator',
    color: '#f59e0b',
    provider: 'gemini',
    desc: 'Accurate reporting using Gemini Flash — generates clear, structured final reports',
  },
}

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

function AgentCard({ agent }: { agent: Agent }) {
  const meta = AGENT_META[agent.name.toLowerCase()] ?? AGENT_META.analyzer
  const isWorking = agent.status === 'working'
  const isError   = agent.status === 'error'

  return (
    <div className={`agent-card${isWorking ? ' working' : ''} anim-fade-up`}>
      {/* Glow line at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: isWorking
          ? `linear-gradient(90deg, transparent, ${meta.color}, transparent)`
          : 'transparent',
        transition: 'background .5s',
      }} />

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <AgentIcon path={meta.icon} color={meta.color} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontSize: '.95rem', fontWeight: 700, textTransform: 'capitalize' }}>
                {agent.name}
              </h3>
              <p style={{ margin: 0, fontSize: '.75rem', color: '#64748b' }}>{meta.role}</p>
            </div>
            <span className={`badge ${isWorking ? 'badge-green' : isError ? 'badge-red' : 'badge-slate'}`}>
              {isWorking ? 'Working' : isError ? 'Error' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      <p style={{ margin: '0 0 14px', fontSize: '.8rem', color: '#475569', lineHeight: 1.55 }}>
        {meta.desc}
      </p>

      {/* Capabilities */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
        {(agent.capabilities?.length > 0
          ? agent.capabilities
          : ['Analysis', 'Planning', 'Verification']
        ).map(cap => (
          <span key={cap} style={{
            padding: '3px 9px',
            fontSize: '.68rem',
            fontWeight: 600,
            letterSpacing: '.04em',
            background: `${meta.color}10`,
            border: `1px solid ${meta.color}25`,
            borderRadius: 999,
            color: meta.color,
          }}>
            {cap}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTop: '1px solid rgba(99,102,241,.08)',
        fontSize: '.75rem',
      }}>
        <div>
          <span style={{ color: '#475569', marginRight: 6 }}>Executions</span>
          <span style={{ color: '#94a3b8', fontWeight: 700 }}>{agent.execution_count ?? 0}</span>
        </div>
        {agent.last_task_id && (
          <div>
            <span style={{ color: '#475569', marginRight: 6 }}>Last task</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748b', fontSize: '.7rem' }}>
              {agent.last_task_id.slice(0, 8)}...
            </span>
          </div>
        )}
        <div>
          <span style={{ color: '#475569', marginRight: 4 }}>LLM</span>
          <span style={{ color: '#94a3b8', fontWeight: 600, textTransform: 'capitalize' }}>
            {agent.llm_provider ? `${agent.llm_provider}` : 'Ollama'}
            {agent.model ? ` (${agent.model === 'gemini-2.5-flash' ? 'Gemini' : agent.model})` : ''}
          </span>
        </div>
      </div>

      {/* Working animation bar */}
      {isWorking && (
        <div style={{ marginTop: 14 }}>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill animated"
              style={{ width: '100%', '--bar-color': meta.color } as React.CSSProperties}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Fallback mock agents for demo when backend is offline
const MOCK_AGENTS: Agent[] = [
  { id: 'analyzer', name: 'Analyzer', role: 'Request Analyzer', status: 'idle', execution_count: 0, capabilities: ['Analysis', 'Evaluation', 'Insight'] },
  { id: 'executor', name: 'Executor', role: 'Action Executor',  status: 'idle', execution_count: 0, capabilities: ['Execution', 'API Calls', 'Orchestration'] },
  { id: 'validator',name: 'Validator',role: 'Result Validator', status: 'idle', execution_count: 0, capabilities: ['Validation', 'Security', 'Compliance'] },
  { id: 'reporter', name: 'Reporter', role: 'Report Generator', status: 'idle', execution_count: 0, capabilities: ['Formatting', 'Reports', 'Summarization'] },
]

export default function AgentBoard({ agents }: { agents: Agent[] }) {
  const display = agents.length > 0 ? agents : MOCK_AGENTS
  const working = display.filter(a => a.status === 'working').length
  const idle    = display.filter(a => a.status === 'idle').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>Agent Board</h2>
          <p style={{ margin: 0, fontSize: '.8rem', color: '#475569' }}>
            4 specialized Claude-powered agents — each with a distinct role in the orchestration pipeline
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="badge badge-green">{working} working</span>
          <span className="badge badge-slate">{idle} idle</span>
        </div>
      </div>

      {/* Pipeline flow diagram (simplified) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '16px 20px',
        background: 'rgba(12,16,32,.8)',
        border: '1px solid rgba(99,102,241,.12)',
        borderRadius: 12,
        overflowX: 'auto',
      }}>
        {['Analyzer', 'Executor', 'Validator', 'Reporter'].map((name, i) => {
          const meta = AGENT_META[name.toLowerCase()]
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '.78rem',
                fontWeight: 600,
                background: `${meta.color}15`,
                border: `1px solid ${meta.color}30`,
                color: meta.color,
              }}>
                {name}
              </div>
              {i < 3 && (
                <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
                  <path d="M1 8h16M12 2l6 6-6 6" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </div>
          )
        })}
        <div style={{ marginLeft: 'auto', fontSize: '.72rem', color: '#334155', flexShrink: 0, paddingLeft: 16 }}>
          All verified by ArmorIQ before execution
        </div>
      </div>

      {/* Agent cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {display.map(agent => <AgentCard key={agent.id} agent={agent} />)}
      </div>

      {agents.length === 0 && (
        <div style={{ textAlign: 'center', fontSize: '.8rem', color: '#334155', paddingTop: 4 }}>
          Showing demo data — connect backend to see live agent status
        </div>
      )}
    </div>
  )
}
