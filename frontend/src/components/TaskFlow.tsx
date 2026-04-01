import type { Task } from '../App'

const STEPS = [
  {
    id: 'submit',
    label: 'Request Received',
    desc: 'User request arrives at FastAPI backend via POST /api/jailbreak',
    color: '#6366f1',
    statusMatch: ['queued', 'processing', 'blocked', 'completed'],
  },
  {
    id: 'armoriq-capture',
    label: 'ArmorIQ Capture Plan',
    desc: 'capture_plan() extracts allowed actions and builds intent hash + merkle root',
    color: '#8b5cf6',
    statusMatch: ['processing', 'blocked', 'completed'],
  },
  {
    id: 'armoriq-token',
    label: 'Intent Token Generated',
    desc: 'Cryptographically signed JWT token (HMAC-SHA256) — expires in 60 seconds',
    color: '#7c3aed',
    statusMatch: ['processing', 'blocked', 'completed'],
  },
  {
    id: 'verify',
    label: 'Policy Enforcement',
    desc: 'verify_action() checks each tool against intent token and active security policies',
    color: '#06b6d4',
    statusMatch: ['processing', 'blocked', 'completed'],
  },
  {
    id: 'analyzer',
    label: 'Analyzer (Ollama)',
    desc: 'Fast local analysis: breaks down request and identifies required actions',
    color: '#3b82f6',
    statusMatch: ['processing', 'completed'],
  },
  {
    id: 'executor',
    label: 'Executor (Gemini Flash)',
    desc: 'Accurate execution: performs approved actions with high precision',
    color: '#10b981',
    statusMatch: ['processing', 'completed'],
  },
  {
    id: 'validator',
    label: 'Validator (Ollama)',
    desc: 'Fast verification: validates results for correctness and compliance',
    color: '#8b5cf6',
    statusMatch: ['processing', 'completed'],
  },
  {
    id: 'reporter',
    label: 'Reporter (Gemini Flash)',
    desc: 'Accurate reporting: generates clear, structured final report',
    color: '#f59e0b',
    statusMatch: ['processing', 'completed'],
  },
  {
    id: 'spacetime',
    label: 'SpacetimeDB Sync',
    desc: 'Results persisted via SpacetimeDB — frontend auto-updates over WebSocket',
    color: '#06b6d4',
    statusMatch: ['completed'],
  },
]

function Step({
  step,
  active,
  done,
  blocked,
  index,
  total,
}: {
  step: typeof STEPS[0]
  active: boolean
  done: boolean
  blocked: boolean
  index: number
  total: number
}) {
  const stateColor = blocked
    ? '#ef4444'
    : done
    ? step.color
    : active
    ? step.color
    : '#1e293b'

  const textColor = blocked
    ? '#fca5a5'
    : done || active
    ? '#e2e8f0'
    : '#334155'

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* Left: connector + dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `2px solid ${stateColor}`,
          background: done || active ? `${stateColor}22` : 'rgba(14,20,40,.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all .4s',
          boxShadow: active && !blocked ? `0 0 12px ${stateColor}55` : 'none',
          flexShrink: 0,
        }}>
          {blocked ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          ) : done ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={step.color} strokeWidth="2.5">
              <path d="M5 13l4 4L19 7"/>
            </svg>
          ) : active ? (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step.color, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ) : (
            <span style={{ fontSize: '.65rem', color: '#334155', fontWeight: 700 }}>{index + 1}</span>
          )}
        </div>
        {index < total - 1 && (
          <div style={{ width: 2, flex: 1, minHeight: 36, background: done ? `linear-gradient(to bottom, ${step.color}55, ${step.color}22)` : 'rgba(30,41,59,.8)', transition: 'background .5s' }} />
        )}
      </div>

      {/* Right: content */}
      <div style={{ flex: 1, paddingBottom: index < total - 1 ? 28 : 0, paddingLeft: 14 }}>
        <div style={{
          padding: '14px 18px',
          borderRadius: 10,
          border: `1px solid ${done || active || blocked ? stateColor + '40' : 'rgba(30,41,59,.8)'}`,
          background: done || active ? `${stateColor}0a` : 'rgba(12,16,32,.7)',
          transition: 'all .4s',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '.87rem', fontWeight: 700, color: textColor, transition: 'color .4s' }}>
              {step.label}
            </span>
            {blocked && (
              <span className="badge badge-red">BLOCKED</span>
            )}
            {done && !blocked && (
              <span className="badge badge-green">Done</span>
            )}
            {active && !done && !blocked && (
              <span className="badge badge-blue">In Progress</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '.78rem', color: '#475569', lineHeight: 1.5 }}>{step.desc}</p>
        </div>
      </div>
    </div>
  )
}

function TaskPipelineCard({ task }: { task: Task }) {
  const isBlocked   = task.status === 'blocked'
  const isCompleted = task.status === 'completed'
  const isProcessing= task.status === 'processing'

  // Progress mapping: 0→step 0, 25→step 4 (analyzer), 50→step 5 (executor), 75→step 6 (validator), 100→step 7 (reporter)
  let activeStepIdx = 0
  const progress = task.progress || 0

  if (isBlocked) {
    activeStepIdx = 3 // Policy enforcement failed
  } else if (isCompleted) {
    activeStepIdx = STEPS.length - 1 // All steps done
  } else if (isProcessing) {
    if (progress < 25) {
      activeStepIdx = 4 // Analyzer running (0-25%)
    } else if (progress < 50) {
      activeStepIdx = 5 // Executor running (25-50%)
    } else if (progress < 75) {
      activeStepIdx = 6 // Validator running (50-75%)
    } else if (progress < 100) {
      activeStepIdx = 7 // Reporter running (75-100%)
    }
  }

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <p style={{ margin: '0 0 4px', fontFamily: 'JetBrains Mono, monospace', fontSize: '.72rem', color: '#475569' }}>
            {task.id}
          </p>
          <p className="line-clamp-2" style={{ margin: 0, fontSize: '.9rem', fontWeight: 600, color: '#e2e8f0', maxWidth: 400 }}>
            {task.user_request}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className={`badge ${
            isBlocked ? 'badge-red' : isCompleted ? 'badge-green' : isProcessing ? 'badge-blue' : 'badge-purple'
          }`}>
            {task.status}
          </span>
          <span style={{ fontSize: '.72rem', color: '#475569' }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <div>
        {STEPS.map((step, i) => (
          <Step
            key={step.id}
            step={step}
            index={i}
            total={STEPS.length}
            done={i < activeStepIdx && !isBlocked}
            active={i === activeStepIdx && isProcessing}
            blocked={isBlocked && i === 3}
          />
        ))}
      </div>
    </div>
  )
}

export default function TaskFlow({ tasks }: { tasks: Task[] }) {
  const activeTasks = tasks.filter(t => t.status !== 'queued')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>Task Execution Pipeline</h2>
          <p style={{ margin: 0, fontSize: '.8rem', color: '#475569' }}>
            6-step pipeline: ArmorIQ verification, policy enforcement, agent execution, and SpacetimeDB sync
          </p>
        </div>
        <span className="badge badge-slate">{activeTasks.length} active</span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { color: '#6366f1', label: 'Pending' },
          { color: '#06b6d4', label: 'Active'  },
          { color: '#10b981', label: 'Done'    },
          { color: '#ef4444', label: 'Blocked' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: '#64748b' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }}/>
            {l.label}
          </div>
        ))}
      </div>

      {activeTasks.length === 0 ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p style={{ color: '#475569', margin: 0, fontWeight: 500 }}>Waiting for tasks</p>
          <p style={{ color: '#334155', fontSize: '.8rem', margin: '4px 0 0' }}>Submit a request from the Dashboard to see the pipeline</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {activeTasks.map(task => <TaskPipelineCard key={task.id} task={task} />)}
        </div>
      )}
    </div>
  )
}
