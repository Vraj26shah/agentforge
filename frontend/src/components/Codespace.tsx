import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Task, UserRole } from '../App'

// Must match App.tsx: in production (monolith), backend = same origin.
const BACKEND = import.meta.env.PROD
  ? window.location.origin
  : (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8001')

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface DiffLine {
  type: 'context' | 'added' | 'removed'
  orig_no: number | null
  mod_no: number | null
  content: string
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'applied' | 'file_switch'
  content: string           // message text (file_switch = full path)
  taskId?: string
  filePath?: string         // which file this Q&A is about
  taskType?: string         // 'code_suggestion' | 'file_question'
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fileIcon(name: string) {
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return '🔷'
  if (name.endsWith('.py')) return '🐍'
  if (name.endsWith('.json')) return '📋'
  if (name.endsWith('.md')) return '📄'
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return '⚙️'
  if (name.endsWith('.css')) return '🎨'
  if (name.endsWith('.sh')) return '⚡'
  if (name.endsWith('.toml') || name.endsWith('.ini') || name.endsWith('.cfg')) return '🔧'
  if (name.endsWith('.rs')) return '🦀'
  if (name.endsWith('.go')) return '🐹'
  return '📃'
}

// ── FileTreeNode ──────────────────────────────────────────────────────────────

function FileTreeNode({
  node, depth, selectedPath, onSelect,
}: {
  node: FileNode; depth: number; selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isDir = node.type === 'directory'
  const isSelected = node.path === selectedPath
  const indent = depth * 14

  if (isDir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            width: '100%', padding: `3px 8px 3px ${6 + indent}px`,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#94a3b8', fontSize: '.76rem', textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: '.65rem', width: 10, flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
          <span>{expanded ? '📂' : '📁'}</span>
          <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{node.name}</span>
        </button>
        {expanded && node.children?.map(c => (
          <FileTreeNode key={c.path} node={c} depth={depth + 1}
            selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        width: '100%', padding: `3px 8px 3px ${6 + indent}px`,
        background: isSelected ? 'rgba(99,102,241,.2)' : 'transparent',
        border: isSelected ? '1px solid rgba(99,102,241,.3)' : '1px solid transparent',
        borderRadius: 4, cursor: 'pointer',
        color: isSelected ? '#a5b4fc' : '#94a3b8',
        fontSize: '.75rem', textAlign: 'left', transition: 'all .12s',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(99,102,241,.08)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: '.72rem', flexShrink: 0 }}>{fileIcon(node.name)}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
    </button>
  )
}

// ── DiffViewer ────────────────────────────────────────────────────────────────

function DiffViewer({
  lines, filePath, onAccept, onReject, onRefine, loading,
}: {
  lines: DiffLine[]; filePath: string; loading?: boolean
  onAccept: () => void; onReject: () => void; onRefine: (msg: string) => void
}) {
  const [refineInput, setRefineInput] = useState('')
  const added = lines.filter(l => l.type === 'added').length
  const removed = lines.filter(l => l.type === 'removed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', flexShrink: 0,
        background: 'rgba(17,24,39,.9)',
        borderBottom: '1px solid rgba(99,102,241,.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>Suggested Changes</span>
          <span style={{ fontFamily: 'monospace', fontSize: '.68rem', color: '#64748b',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
            {filePath}
          </span>
          <span style={{ fontSize: '.68rem', color: '#4ade80', background: 'rgba(74,222,128,.1)', padding: '1px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
            +{added}
          </span>
          <span style={{ fontSize: '.68rem', color: '#f87171', background: 'rgba(248,113,113,.1)', padding: '1px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
            -{removed}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
          <button onClick={onAccept} disabled={loading} style={{
            padding: '5px 16px', borderRadius: 6, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(74,222,128,.2)' : 'rgba(74,222,128,.25)',
            color: '#4ade80', fontSize: '.78rem', fontWeight: 700, transition: 'all .15s',
          }}>
            {loading ? 'Applying…' : '✓ Accept & Apply'}
          </button>
          <button onClick={onReject} disabled={loading} style={{
            padding: '5px 14px', borderRadius: 6, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: 'rgba(248,113,113,.1)', color: '#f87171',
            fontSize: '.78rem', fontWeight: 700, transition: 'all .15s',
          }}>
            ✗ Reject
          </button>
        </div>
      </div>

      {/* Diff lines */}
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: '.74rem' }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            display: 'flex', minWidth: 0,
            background: line.type === 'added' ? 'rgba(74,222,128,.07)'
              : line.type === 'removed' ? 'rgba(248,113,113,.07)' : 'transparent',
            borderLeft: `3px solid ${
              line.type === 'added' ? '#4ade80'
              : line.type === 'removed' ? '#f87171' : 'transparent'
            }`,
          }}>
            <span style={{ width: 38, minWidth: 38, textAlign: 'right', padding: '1px 5px',
              color: '#1e293b', background: 'rgba(0,0,0,.25)', userSelect: 'none', fontSize: '.68rem', lineHeight: '20px' }}>
              {line.orig_no ?? ''}
            </span>
            <span style={{ width: 38, minWidth: 38, textAlign: 'right', padding: '1px 5px',
              color: '#1e293b', background: 'rgba(0,0,0,.2)', userSelect: 'none', fontSize: '.68rem', lineHeight: '20px' }}>
              {line.mod_no ?? ''}
            </span>
            <span style={{
              padding: '1px 8px', lineHeight: '20px', whiteSpace: 'pre', overflow: 'hidden',
              color: line.type === 'added' ? '#86efac' : line.type === 'removed' ? '#fca5a5' : '#64748b',
            }}>
              {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
              {line.content}
            </span>
          </div>
        ))}
      </div>

      {/* Refine input — follow-up prompt without leaving diff view */}
      <div style={{
        padding: '8px 12px', flexShrink: 0,
        borderTop: '1px solid rgba(99,102,241,.1)',
        background: 'rgba(10,14,28,.85)',
      }}>
        <div style={{ fontSize: '.66rem', color: '#475569', marginBottom: 5 }}>
          Not quite right? Refine the suggestion:
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <input
            value={refineInput}
            onChange={e => setRefineInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && refineInput.trim()) {
                onRefine(refineInput.trim())
                setRefineInput('')
              }
            }}
            placeholder="e.g. also add error handling…"
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 6,
              border: '1px solid rgba(99,102,241,.2)', outline: 'none',
              background: 'rgba(17,24,39,.8)', color: '#e2e8f0', fontSize: '.76rem',
            }}
          />
          <button
            onClick={() => { if (refineInput.trim()) { onRefine(refineInput.trim()); setRefineInput('') } }}
            style={{
              padding: '6px 12px', borderRadius: 6, border: 'none',
              background: 'rgba(99,102,241,.2)', color: '#a5b4fc',
              fontSize: '.75rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Re-run
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AppliedBanner ─────────────────────────────────────────────────────────────

function AppliedBanner({ filePath, onDismiss }: { filePath: string; onDismiss: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', flexShrink: 0,
      background: 'rgba(74,222,128,.08)',
      border: '1px solid rgba(74,222,128,.2)',
      borderRadius: 8, margin: '8px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1rem' }}>✅</span>
        <div>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#4ade80' }}>Changes applied to codebase</div>
          <div style={{ fontSize: '.68rem', color: '#6ee7b7', fontFamily: 'monospace', marginTop: 2 }}>{filePath}</div>
        </div>
      </div>
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#4ade80', fontSize: '.9rem', padding: '2px 6px',
      }}>✕</button>
    </div>
  )
}

// ── NewFileModal ──────────────────────────────────────────────────────────────

function NewFileModal({ onConfirm, onClose }: {
  onConfirm: (path: string) => void; onClose: () => void
}) {
  const [path, setPath] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(10,14,28,.98)',
        border: '1px solid rgba(99,102,241,.3)',
        borderRadius: 12, padding: 24, width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,.6)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>
          New File
        </div>
        <div style={{ fontSize: '.72rem', color: '#64748b', marginBottom: 8 }}>
          File path (relative to project root):
        </div>
        <input
          ref={inputRef}
          value={path}
          onChange={e => setPath(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && path.trim()) { onConfirm(path.trim()); onClose() }
            if (e.key === 'Escape') onClose()
          }}
          placeholder="e.g. frontend/src/components/MyComponent.tsx"
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 7,
            border: '1px solid rgba(99,102,241,.25)', outline: 'none',
            background: 'rgba(17,24,39,.8)', color: '#e2e8f0', fontSize: '.8rem',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '6px 16px', borderRadius: 6, border: 'none',
            background: 'rgba(99,102,241,.08)', color: '#64748b',
            fontSize: '.78rem', cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={() => { if (path.trim()) { onConfirm(path.trim()); onClose() } }}
            style={{
              padding: '6px 18px', borderRadius: 6, border: 'none',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color: '#fff', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer',
            }}
          >Create</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Codespace ────────────────────────────────────────────────────────────

interface Props { tasks: Task[]; role: UserRole; sessionId: string }

export default function Codespace({ tasks, role, sessionId }: Props) {
  const [tree, setTree]                       = useState<FileNode[]>([])
  const [treeLoaded, setTreeLoaded]           = useState(false)
  const [treeError, setTreeError]             = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(() => {
    try { return localStorage.getItem(`agentforge_path_${sessionId}`) } catch { return null }
  })
  const [fileContent, setFileContent]         = useState('')
  const [editorContent, setEditorContent]     = useState('')
  const [isDirty, setIsDirty]                 = useState(false)
  const [saving, setSaving]                   = useState(false)
  const [saveMsg, setSaveMsg]                 = useState('')
  const [loadingFile, setLoadingFile]         = useState(false)
  const [appliedBanner, setAppliedBanner]     = useState<string | null>(null)
  const [showNewFile, setShowNewFile]         = useState(false)
  const [openPathInput, setOpenPathInput]     = useState('')
  const [showOpenPath, setShowOpenPath]       = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(`agentforge_chat_${sessionId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[]
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [{ role: 'system', content: 'Open a file from the explorer, then ask a question or describe a code change.' }]
  })
  const [chatInput, setChatInput]   = useState('')
  const [aiLoading, setAiLoading]   = useState<boolean>(() => {
    try { return Boolean(localStorage.getItem(`agentforge_pending_${sessionId}`)) } catch { return false }
  })
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(() => {
    try { return localStorage.getItem(`agentforge_pending_${sessionId}`) } catch { return null }
  })

  const [suggestion, setSuggestion] = useState<{ content: string; diffLines: DiffLine[] } | null>(null)
  const [applying, setApplying]     = useState(false)

  const editorRef       = useRef<HTMLTextAreaElement>(null)
  const gutterRef       = useRef<HTMLDivElement>(null)
  const chatEndRef      = useRef<HTMLDivElement>(null)
  const importRef       = useRef<HTMLInputElement>(null)
  const handledTaskIds  = useRef(new Set<string>())
  // Captures the path that was stored in localStorage at mount time — used by the
  // one-shot effect below to silently reload file content without touching chat.
  const mountPathRef = useRef(selectedPath)

  // ── load tree ───────────────────────────────────────────────────────────────

  const refreshTree = useCallback(() => {
    setTreeError(false)
    fetch(`${BACKEND}/api/codespace/tree`)
      .then(r => {
        if (!r.ok) throw new Error('not ok')
        return r.json()
      })
      .then(d => { setTree(d.tree || []); setTreeError(false) })
      .catch(() => { setTreeError(true) })
      .finally(() => { setTreeLoaded(true) })
  }, [])

  useEffect(() => { refreshTree() }, [refreshTree])

  // ── auto-scroll chat ────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, aiLoading])

  // ── persist chat & pending task to localStorage ──────────────────────────────

  useEffect(() => {
    try {
      localStorage.setItem(`agentforge_chat_${sessionId}`, JSON.stringify(chatMessages.slice(-200)))
    } catch {}
  }, [chatMessages, sessionId])

  useEffect(() => {
    try {
      if (pendingTaskId) {
        localStorage.setItem(`agentforge_pending_${sessionId}`, pendingTaskId)
      } else {
        localStorage.removeItem(`agentforge_pending_${sessionId}`)
      }
    } catch {}
  }, [pendingTaskId, sessionId])

  useEffect(() => {
    try {
      if (selectedPath) {
        localStorage.setItem(`agentforge_path_${sessionId}`, selectedPath)
      } else {
        localStorage.removeItem(`agentforge_path_${sessionId}`)
      }
    } catch {}
  }, [selectedPath, sessionId])

  // On mount: silently reload file content when a path was restored from localStorage.
  // openFile is intentionally NOT called here — it would add a file_switch chat message.
  useEffect(() => {
    const path = mountPathRef.current
    if (!path) return
    setLoadingFile(true)
    fetch(`${BACKEND}/api/codespace/file?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setFileContent(data.content)
          setEditorContent(data.content)
          setIsDirty(false)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFile(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentionally mount-only

  // On mount: validate that a stale pendingTaskId from localStorage is still alive.
  // If the backend restarted and lost the task, clear the stuck loading state.
  useEffect(() => {
    const staleId = pendingTaskId
    if (!staleId) return
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`${BACKEND}/api/tasks/${staleId}`)
        .then(r => {
          if (!r.ok) throw new Error('not found')
          return r.json()
        })
        .then(task => {
          if (cancelled) return
          // If task already terminal but handleTaskResult hasn't fired, clear stale state
          const terminal = task.status === 'completed' || task.status === 'blocked' || task.status === 'error'
          if (!terminal) return // still in progress, let polling handle it
        })
        .catch(() => {
          // Task doesn't exist on the backend anymore — clear stuck state
          if (cancelled) return
          setPendingTaskId(null)
          setAiLoading(false)
          setChatMessages(prev => [...prev, {
            role: 'system' as const,
            content: 'Previous AI request was lost (backend restarted). You can send a new request.',
            filePath: selectedPath ?? undefined,
          }])
        })
    }, 2000) // Give WebSocket 2s to reconnect first
    return () => { cancelled = true; clearTimeout(timer) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentionally mount-only

  // ── filter messages for current file ────────────────────────────────────────

  const displayedMessages = useMemo((): ChatMessage[] => {
    if (!selectedPath) {
      return chatMessages.filter(m => m.role === 'system' && !m.filePath)
    }
    const fileMessages = chatMessages.filter(
      m => m.role !== 'file_switch' && m.filePath === selectedPath
    )
    if (fileMessages.length === 0) {
      return [{
        role: 'system' as const,
        content: `${selectedPath.split('/').pop()} — ask a question or describe a code change.`,
        filePath: selectedPath,
      }]
    }
    return fileMessages
  }, [chatMessages, selectedPath])

  // ── watch tasks for completed code suggestion ─────────────────────────────
  // Primary: WebSocket events update `tasks` prop — detected here.
  // Fallback: HTTP polling every 2s in case WebSocket messages are missed.

  const handleTaskResult = useCallback((task: Task, taskId: string) => {
    // Prevent WebSocket and HTTP polling from both firing for the same completed task.
    const terminal = task.status === 'completed' || task.status === 'blocked' || task.status === 'error'
    if (!terminal) return
    if (handledTaskIds.current.has(taskId)) return
    handledTaskIds.current.add(taskId)

    const fp = task.file_path  // always tag replies with which file they're about

    if (task.status === 'completed' && task.task_type === 'code_suggestion') {
      // Guard: suggested_content undefined means partial data from existing_tasks snapshot.
      // Return early so HTTP polling can fetch the full task with all fields.
      if (task.suggested_content === undefined) return

      const suggested = task.suggested_content ?? ''
      const diffLines = (task.diff_lines as DiffLine[]) ?? []

      if (!suggested || diffLines.length === 0) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'The agent returned an empty suggestion. The file may be too large or the prompt unclear.',
          filePath: fp, taskId,
        }])
        setAiLoading(false)
        setPendingTaskId(null)
        return
      }

      setSuggestion({ content: suggested, diffLines })
      setAiLoading(false)
      const added   = diffLines.filter(l => l.type === 'added').length
      const removed = diffLines.filter(l => l.type === 'removed').length
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Suggestion ready — ${added} additions, ${removed} deletions.\nReview the diff, then Accept to apply or Reject to discard.`,
        filePath: fp, taskId, taskType: 'code_suggestion',
      }])
      setPendingTaskId(null)

    } else if (task.status === 'completed') {
      // Guard: report undefined means partial data from existing_tasks snapshot.
      // The completion broadcast always sets report to at least ''. Return early
      // so HTTP polling can fetch the full task and deliver the real response.
      if (task.report === undefined) return

      const answer = task.report ?? ''
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: answer || 'Agent completed but returned no output.',
        filePath: fp, taskId, taskType: 'file_question',
      }])
      setAiLoading(false)
      setPendingTaskId(null)

    } else if (task.status === 'blocked') {
      setAiLoading(false)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `🚫 ArmorIQ blocked this request:\n${task.blocked_reason ?? 'Policy denied for your current role.'}`,
        filePath: fp, taskId,
      }])
      setPendingTaskId(null)

    } else if (task.status === 'error') {
      setAiLoading(false)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Agent error: ${task.blocked_reason ?? 'Unknown error in pipeline.'}`,
        filePath: fp, taskId,
      }])
      setPendingTaskId(null)
    }
  }, [])

  // WebSocket-based detection
  useEffect(() => {
    if (!pendingTaskId) return
    const task = tasks.find(t => t.id === pendingTaskId)
    if (!task) return
    handleTaskResult(task, pendingTaskId)
  }, [tasks, pendingTaskId, handleTaskResult])

  // HTTP polling fallback — starts 3s after submission, polls every 2s, gives up after 60s
  useEffect(() => {
    if (!pendingTaskId) return
    let stopped = false
    let pollCount = 0
    const MAX_POLLS = 30 // 30 × 2s = 60s timeout

    const poll = async () => {
      pollCount++
      if (pollCount > MAX_POLLS) {
        // Give up — backend likely lost this task
        setPendingTaskId(null)
        setAiLoading(false)
        setChatMessages(prev => [...prev, {
          role: 'system' as const,
          content: 'AI request timed out — the backend may have restarted. Please try again.',
          filePath: selectedPath ?? undefined,
        }])
        return
      }
      try {
        const res  = await fetch(`${BACKEND}/api/tasks/${pendingTaskId}`)
        if (!res.ok) {
          // 404 = task lost after backend restart
          if (res.status === 404) {
            setPendingTaskId(null)
            setAiLoading(false)
            setChatMessages(prev => [...prev, {
              role: 'system' as const,
              content: 'AI request was lost (backend restarted). Please try again.',
              filePath: selectedPath ?? undefined,
            }])
          }
          return
        }
        const task: Task = await res.json()
        if (stopped) return
        const terminal = task.status !== 'queued' && task.status !== 'processing'
        if (terminal) handleTaskResult(task, pendingTaskId)
      } catch { /* ignore network errors — WS will catch up */ }
    }

    // Start polling after a 3-second grace period (WS should deliver first)
    const delay = setTimeout(() => {
      if (stopped) return
      poll()
      const interval = setInterval(() => {
        if (stopped) { clearInterval(interval); return }
        poll()
      }, 2000)
      // Store interval ID for cleanup
      const cleanup = () => clearInterval(interval)
      ;(delay as any).__cleanup = cleanup
    }, 3000)

    return () => { stopped = true; clearTimeout(delay) }
  }, [pendingTaskId, handleTaskResult]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── open file ───────────────────────────────────────────────────────────────

  const openFile = useCallback(async (path: string) => {
    setSelectedPath(path)
    setLoadingFile(true)
    setSuggestion(null)
    setAppliedBanner(null)
    try {
      const res  = await fetch(`${BACKEND}/api/codespace/file?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (data.error) {
        setChatMessages(prev => [...prev, { role: 'system', content: `Error: ${data.error}`, filePath: path }])
      } else {
        setFileContent(data.content)
        setEditorContent(data.content)
        setIsDirty(false)
        // Add a file-switch separator so the conversation is clearly scoped to this file
        setChatMessages(prev => {
          const lastSwitch = [...prev].reverse().find(m => m.role === 'file_switch')
          if (lastSwitch?.content === path) return prev  // same file re-opened, no duplicate
          return [...prev, {
            role: 'file_switch' as const,
            content: path,
            filePath: path,
          }]
        })
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'system', content: `Failed to load: ${e}`, filePath: path }])
    } finally {
      setLoadingFile(false)
    }
  }, [])

  // ── save file ───────────────────────────────────────────────────────────────

  const saveFile = useCallback(async (content?: string, path?: string): Promise<boolean> => {
    const targetPath    = path ?? selectedPath
    const contentToSave = content ?? editorContent
    if (!targetPath) return false
    setSaving(true)
    try {
      const res  = await fetch(`${BACKEND}/api/codespace/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, content: contentToSave }),
      })
      const data = await res.json()
      if (data.error) {
        setSaveMsg(`Error: ${data.error}`)
        return false
      }
      setFileContent(contentToSave)
      setIsDirty(false)
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(''), 2500)
      refreshTree()
      return true
    } catch (e) {
      setSaveMsg(`Save failed: ${e}`)
      return false
    } finally {
      setSaving(false)
    }
  }, [selectedPath, editorContent, refreshTree])

  // ── import local file ───────────────────────────────────────────────────────

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      // Use the filename as a virtual path in the root (user can edit/save it)
      const virtualPath = file.name
      setSelectedPath(virtualPath)
      setFileContent(content)
      setEditorContent(content)
      setIsDirty(true)
      setSuggestion(null)
      setAppliedBanner(null)
      setChatMessages(prev => [...prev, {
        role: 'file_switch' as const,
        content: file.name,
        filePath: file.name,
      }])
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }, [])

  // ── create new file ─────────────────────────────────────────────────────────

  const createNewFile = useCallback((path: string) => {
    setSelectedPath(path)
    setFileContent('')
    setEditorContent('')
    setIsDirty(true)
    setSuggestion(null)
    setAppliedBanner(null)
    setChatMessages(prev => [...prev, {
      role: 'file_switch' as const,
      content: path,
      filePath: path,
    }])
  }, [])

  // ── open by typed path ──────────────────────────────────────────────────────

  const commitOpenPath = useCallback(() => {
    const p = openPathInput.trim()
    if (p) { openFile(p); setOpenPathInput(''); setShowOpenPath(false) }
  }, [openPathInput, openFile])

  // ── send AI chat message ────────────────────────────────────────────────────

  const sendChat = useCallback(async (message?: string) => {
    const msg = (message ?? chatInput).trim()
    if (!msg || !selectedPath || aiLoading) return
    if (!message) setChatInput('')

    // Tag user message with which file it's about
    setChatMessages(prev => [...prev, { role: 'user', content: msg, filePath: selectedPath }])
    setAiLoading(true)
    setSuggestion(null)

    try {
      // Build chat history: only messages about the currently open file, last 10
      const currentHistory = chatMessages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.filePath === selectedPath)
        .slice(-10)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const res  = await fetch(`${BACKEND}/api/codespace/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: selectedPath,
          request: msg,
          user_id: sessionId,
          role,
          chat_history: currentHistory,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}`, filePath: selectedPath }])
        setAiLoading(false)
      } else {
        setPendingTaskId(data.task_id)
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Request failed: ${e}`, filePath: selectedPath }])
      setAiLoading(false)
    }
  }, [chatInput, selectedPath, aiLoading, sessionId, role, chatMessages])

  // ── accept suggestion → apply to codebase ───────────────────────────────────

  const acceptSuggestion = useCallback(async () => {
    if (!suggestion || !selectedPath) return
    setApplying(true)
    const ok = await saveFile(suggestion.content)
    if (ok) {
      setEditorContent(suggestion.content)
      setSuggestion(null)
      setAppliedBanner(selectedPath)
      setChatMessages(prev => [...prev, {
        role: 'applied',
        content: `Changes written to ${selectedPath}`,
        filePath: selectedPath,
      }])
    }
    setApplying(false)
  }, [suggestion, selectedPath, saveFile])

  // ── reject suggestion ────────────────────────────────────────────────────────

  const rejectSuggestion = useCallback(() => {
    setSuggestion(null)
    setChatMessages(prev => [...prev, { role: 'system', content: 'Changes rejected — file unchanged.', filePath: selectedPath ?? undefined }])
  }, [])

  // ── refine suggestion (re-run with follow-up) ────────────────────────────────

  const refineSuggestion = useCallback((msg: string) => {
    setSuggestion(null)
    sendChat(msg)
  }, [sendChat])

  // ── line number gutter sync ──────────────────────────────────────────────────

  const syncScroll = useCallback(() => {
    if (editorRef.current && gutterRef.current)
      gutterRef.current.scrollTop = editorRef.current.scrollTop
  }, [])

  // ── keyboard shortcut: Ctrl/Cmd+S ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && selectedPath && isDirty) {
        e.preventDefault()
        saveFile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPath, isDirty, saveFile])

  const lineCount = editorContent.split('\n').length

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {showNewFile && (
        <NewFileModal onConfirm={createNewFile} onClose={() => setShowNewFile(false)} />
      )}

      {/* Hidden file-import input */}
      <input
        ref={importRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleImport}
      />

      <div style={{
        display: 'flex', height: 'calc(100vh - 220px)',
        background: 'rgba(8,11,22,.97)',
        border: '1px solid rgba(99,102,241,.15)',
        borderRadius: 12, overflow: 'hidden',
      }}>

        {/* ── LEFT: File Tree ──────────────────────────────────── */}
        <div style={{
          width: 220, minWidth: 220, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid rgba(99,102,241,.1)',
          overflow: 'hidden',
        }}>
          {/* Tree header + actions */}
          <div style={{
            padding: '8px 10px', borderBottom: '1px solid rgba(99,102,241,.1)',
            background: 'rgba(10,14,28,.8)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '.68rem', fontWeight: 700, color: '#475569', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Explorer
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Refresh */}
                <button onClick={refreshTree} title="Refresh" style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#475569', fontSize: '.8rem', padding: '2px 4px', borderRadius: 4,
                }}>↻</button>
                {/* New file */}
                <button onClick={() => setShowNewFile(true)} title="New file" style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#475569', fontSize: '.85rem', padding: '2px 4px', borderRadius: 4,
                }}>＋</button>
              </div>
            </div>

            {/* Import + Open-path row */}
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                onClick={() => importRef.current?.click()}
                title="Import a local file into the editor"
                style={{
                  flex: 1, padding: '4px 8px', borderRadius: 5,
                  border: '1px solid rgba(99,102,241,.2)',
                  background: 'rgba(99,102,241,.08)', color: '#818cf8',
                  fontSize: '.68rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <span>⬆</span> Import
              </button>
              <button
                onClick={() => setShowOpenPath(v => !v)}
                title="Open file by path"
                style={{
                  flex: 1, padding: '4px 8px', borderRadius: 5,
                  border: '1px solid rgba(99,102,241,.2)',
                  background: showOpenPath ? 'rgba(99,102,241,.18)' : 'rgba(99,102,241,.08)',
                  color: '#818cf8', fontSize: '.68rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <span>📂</span> Open
              </button>
            </div>

            {/* Open-by-path input */}
            {showOpenPath && (
              <div style={{ marginTop: 6 }}>
                <input
                  value={openPathInput}
                  onChange={e => setOpenPathInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitOpenPath()
                    if (e.key === 'Escape') { setShowOpenPath(false); setOpenPathInput('') }
                  }}
                  autoFocus
                  placeholder="path/to/file.py"
                  style={{
                    width: '100%', padding: '5px 8px', borderRadius: 5,
                    border: '1px solid rgba(99,102,241,.25)', outline: 'none',
                    background: 'rgba(17,24,39,.8)', color: '#e2e8f0',
                    fontSize: '.72rem', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {!treeLoaded ? (
              <div style={{ padding: 12, fontSize: '.72rem', color: '#475569' }}>Loading…</div>
            ) : treeError ? (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '.72rem', color: '#f87171', marginBottom: 6 }}>Could not load file tree</div>
                <button onClick={refreshTree} style={{
                  padding: '4px 12px', borderRadius: 5, border: '1px solid rgba(99,102,241,.2)',
                  background: 'rgba(99,102,241,.1)', color: '#818cf8',
                  fontSize: '.68rem', fontWeight: 600, cursor: 'pointer',
                }}>
                  ↻ Retry
                </button>
              </div>
            ) : tree.length === 0 ? (
              <div style={{ padding: 12, fontSize: '.72rem', color: '#334155' }}>No files found</div>
            ) : (
              tree.map(n => (
                <FileTreeNode key={n.path} node={n} depth={0}
                  selectedPath={selectedPath} onSelect={openFile} />
              ))
            )}
          </div>
        </div>

        {/* ── CENTER: Editor / Diff ─────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 14px', flexShrink: 0,
            borderBottom: '1px solid rgba(99,102,241,.1)',
            background: 'rgba(10,14,28,.85)',
          }}>
            <div style={{ fontSize: '.76rem', color: '#64748b', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {selectedPath
                ? <><span style={{ color: '#94a3b8' }}>{selectedPath}</span>
                    {isDirty && <span style={{ color: '#fbbf24', marginLeft: 6 }}>●</span>}
                    {suggestion && <span style={{
                      marginLeft: 10, fontSize: '.65rem', padding: '2px 8px',
                      borderRadius: 99, background: 'rgba(251,191,36,.12)',
                      color: '#fbbf24', border: '1px solid rgba(251,191,36,.2)',
                    }}>diff pending</span>}
                  </>
                : 'No file open'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {saveMsg && <span style={{ fontSize: '.7rem', color: saveMsg.startsWith('Error') ? '#f87171' : '#4ade80' }}>{saveMsg}</span>}
              {suggestion && (
                <button onClick={acceptSuggestion} disabled={applying} style={{
                  padding: '4px 14px', borderRadius: 5, border: 'none', cursor: applying ? 'not-allowed' : 'pointer',
                  background: 'rgba(74,222,128,.25)', color: '#4ade80',
                  fontSize: '.74rem', fontWeight: 700,
                }}>
                  {applying ? 'Applying…' : '✓ Accept & Apply'}
                </button>
              )}
              {suggestion && (
                <button onClick={rejectSuggestion} style={{
                  padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  background: 'rgba(248,113,113,.1)', color: '#f87171',
                  fontSize: '.74rem', fontWeight: 700,
                }}>✗ Reject</button>
              )}
              <button
                onClick={() => saveFile()}
                disabled={!selectedPath || !isDirty || saving}
                style={{
                  padding: '4px 14px', borderRadius: 5, border: 'none',
                  background: isDirty ? 'rgba(99,102,241,.25)' : 'rgba(99,102,241,.08)',
                  color: isDirty ? '#a5b4fc' : '#475569',
                  fontSize: '.74rem', fontWeight: 600,
                  cursor: selectedPath && isDirty ? 'pointer' : 'not-allowed',
                  transition: 'all .15s',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Applied banner */}
          {appliedBanner && (
            <AppliedBanner filePath={appliedBanner} onDismiss={() => setAppliedBanner(null)} />
          )}

          {/* Body */}
          {loadingFile ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '.85rem' }}>
              Loading file…
            </div>

          ) : suggestion ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <DiffViewer
                lines={suggestion.diffLines}
                filePath={selectedPath ?? ''}
                onAccept={acceptSuggestion}
                onReject={rejectSuggestion}
                onRefine={refineSuggestion}
                loading={applying}
              />
            </div>

          ) : selectedPath ? (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Line gutter */}
              <div ref={gutterRef} style={{
                width: 46, minWidth: 46, overflow: 'hidden',
                background: 'rgba(10,14,28,.5)',
                borderRight: '1px solid rgba(99,102,241,.07)',
                paddingTop: 10, userSelect: 'none',
              }}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} style={{
                    textAlign: 'right', paddingRight: 10,
                    fontSize: '.72rem', lineHeight: '21px',
                    color: '#1e293b', fontFamily: 'monospace',
                  }}>
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code textarea */}
              <textarea
                ref={editorRef}
                value={editorContent}
                onChange={e => { setEditorContent(e.target.value); setIsDirty(true) }}
                onScroll={syncScroll}
                spellCheck={false}
                style={{
                  flex: 1, resize: 'none', border: 'none', outline: 'none',
                  background: 'transparent', color: '#e2e8f0',
                  fontFamily: 'monospace', fontSize: '.78rem', lineHeight: '21px',
                  padding: '10px 12px',
                  whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto',
                }}
              />
            </div>

          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '.88rem', color: '#334155', fontWeight: 600 }}>No file open</div>
                <div style={{ fontSize: '.75rem', color: '#1e293b', marginTop: 6 }}>
                  Pick a file from the explorer, import from disk, or open by path
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => importRef.current?.click()} style={{
                  padding: '7px 16px', borderRadius: 7,
                  border: '1px solid rgba(99,102,241,.25)',
                  background: 'rgba(99,102,241,.1)', color: '#818cf8',
                  fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
                }}>
                  ⬆ Import file
                </button>
                <button onClick={() => setShowNewFile(true)} style={{
                  padding: '7px 16px', borderRadius: 7,
                  border: '1px solid rgba(99,102,241,.25)',
                  background: 'rgba(99,102,241,.1)', color: '#818cf8',
                  fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
                }}>
                  ＋ New file
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: AI Chat ──────────────────────────────────── */}
        <div style={{
          width: 340, minWidth: 340, display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid rgba(99,102,241,.1)', overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '10px 14px', flexShrink: 0,
            borderBottom: '1px solid rgba(99,102,241,.1)',
            background: 'rgba(10,14,28,.85)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6,
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#e2e8f0' }}>AI Code Assistant</div>
                <div style={{ fontSize: '.63rem', color: '#475569' }}>
                  Analyzer → Executor → Validator → Reporter · ArmorIQ RBAC
                </div>
              </div>
            </div>

            {/* Context indicator */}
            <div style={{
              marginTop: 8, padding: '5px 10px', borderRadius: 6,
              background: selectedPath ? 'rgba(99,102,241,.08)' : 'rgba(251,191,36,.06)',
              border: `1px solid ${selectedPath ? 'rgba(99,102,241,.15)' : 'rgba(251,191,36,.15)'}`,
              fontSize: '.68rem',
              color: selectedPath ? '#818cf8' : '#fbbf24',
              fontFamily: selectedPath ? 'monospace' : 'inherit',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {selectedPath ? `📄 ${selectedPath}` : '⚠ Select a file to enable AI suggestions'}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            {displayedMessages.map((msg, i) => {
              const fileName = msg.filePath ? msg.filePath.split('/').pop() : null

              // ── file-switch separator ───────────────────────────────
              if (msg.role === 'file_switch') {
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    margin: '12px 0 10px',
                  }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,.12)' }} />
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 99,
                      background: 'rgba(99,102,241,.1)',
                      border: '1px solid rgba(99,102,241,.2)',
                      fontSize: '.63rem', fontWeight: 700,
                      color: '#818cf8', fontFamily: 'monospace',
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      📄 {msg.content}
                    </div>
                    <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,.12)' }} />
                  </div>
                )
              }

              // ── system pill ─────────────────────────────────────────
              if (msg.role === 'system') {
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <div style={{
                      fontSize: '.63rem', color: '#334155',
                      padding: '2px 10px', borderRadius: 99,
                      background: 'rgba(51,65,85,.12)',
                      border: '1px solid rgba(51,65,85,.18)',
                      maxWidth: '92%', textAlign: 'center',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              }

              // ── applied banner ──────────────────────────────────────
              if (msg.role === 'applied') {
                return (
                  <div key={i} style={{
                    padding: '7px 10px', borderRadius: 7, marginBottom: 8,
                    background: 'rgba(74,222,128,.07)',
                    border: '1px solid rgba(74,222,128,.2)',
                    fontSize: '.72rem', color: '#4ade80',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <span>✅</span>
                    <span>{msg.content}</span>
                  </div>
                )
              }

              // ── user message ────────────────────────────────────────
              if (msg.role === 'user') {
                return (
                  <div key={i} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                    marginBottom: 10,
                  }}>
                    {/* file badge */}
                    {fileName && (
                      <div style={{
                        fontSize: '.6rem', color: '#475569', fontFamily: 'monospace',
                        marginBottom: 3, padding: '1px 7px',
                        background: 'rgba(71,85,105,.12)',
                        border: '1px solid rgba(71,85,105,.2)',
                        borderRadius: 4,
                      }}>
                        📄 {fileName}
                      </div>
                    )}
                    <div style={{
                      maxWidth: '86%', padding: '8px 12px',
                      borderRadius: '12px 12px 3px 12px',
                      background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                      fontSize: '.78rem', lineHeight: 1.55, color: '#f0f0ff',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              }

              // ── assistant message ───────────────────────────────────
              return (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  marginBottom: 10,
                }}>
                  {/* agent label */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5,
                      background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#4f46e5', letterSpacing: '.04em' }}>
                      AgentForge
                    </span>
                    {fileName && (
                      <span style={{
                        fontSize: '.6rem', color: '#334155', fontFamily: 'monospace',
                        padding: '1px 6px', borderRadius: 3,
                        background: 'rgba(51,65,85,.15)',
                      }}>
                        re: {fileName}
                      </span>
                    )}
                  </div>
                  <div style={{
                    maxWidth: '90%', padding: '8px 12px',
                    borderRadius: '3px 12px 12px 12px',
                    background: 'rgba(30,41,59,.9)',
                    border: '1px solid rgba(99,102,241,.15)',
                    fontSize: '.77rem', lineHeight: 1.6, color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                </div>
              )
            })}

            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: 99, background: '#6366f1',
                      animation: `csb 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '.7rem', color: '#475569' }}>Agent pipeline running…</span>
                <button
                  onClick={() => {
                    setPendingTaskId(null)
                    setAiLoading(false)
                    setChatMessages(prev => [...prev, {
                      role: 'system' as const,
                      content: 'AI request cancelled.',
                      filePath: selectedPath ?? undefined,
                    }])
                  }}
                  style={{
                    padding: '2px 10px', borderRadius: 5, border: 'none',
                    background: 'rgba(248,113,113,.12)', color: '#f87171',
                    fontSize: '.65rem', fontWeight: 700, cursor: 'pointer',
                    marginLeft: 4, transition: 'all .15s',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '10px 12px', flexShrink: 0,
            borderTop: '1px solid rgba(99,102,241,.1)',
            background: 'rgba(10,14,28,.85)',
          }}>
            <div style={{ display: 'flex', gap: 7 }}>
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
                }}
                placeholder={
                  !selectedPath ? 'Open a file first…'
                  : suggestion ? 'Describe a follow-up refinement…'
                  : 'Describe a code change… (Enter to send)'
                }
                disabled={!selectedPath || aiLoading}
                rows={3}
                style={{
                  flex: 1, resize: 'none', border: '1px solid rgba(99,102,241,.2)',
                  borderRadius: 8, outline: 'none',
                  background: !selectedPath ? 'rgba(17,24,39,.4)' : 'rgba(17,24,39,.8)',
                  color: '#e2e8f0', fontSize: '.77rem', padding: '7px 10px', lineHeight: 1.5,
                  fontFamily: 'inherit', transition: 'border-color .15s',
                }}
              />
              <button
                onClick={() => sendChat()}
                disabled={!selectedPath || !chatInput.trim() || aiLoading}
                style={{
                  padding: '0 13px', borderRadius: 8, border: 'none', alignSelf: 'stretch',
                  background: selectedPath && chatInput.trim() && !aiLoading
                    ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                    : 'rgba(99,102,241,.1)',
                  color: selectedPath && chatInput.trim() && !aiLoading ? '#fff' : '#334155',
                  cursor: selectedPath && chatInput.trim() && !aiLoading ? 'pointer' : 'not-allowed',
                  fontSize: '.78rem', fontWeight: 700, transition: 'all .15s',
                }}
              >
                Send
              </button>
            </div>
            <div style={{ fontSize: '.63rem', color: '#1e293b', marginTop: 4 }}>
              Enter to send · Shift+Enter new line · Ctrl+S save
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes csb {
          0%, 80%, 100% { transform: translateY(0); opacity: .6; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
