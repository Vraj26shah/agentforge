import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
        id: 'execute',
        label: 'Agent Execution',
        desc: '4 specialized Claude agents run in orchestrated pipeline: Analyzer → Executor → Validator → Reporter',
        color: '#10b981',
        statusMatch: ['processing', 'completed'],
    },
    {
        id: 'spacetime',
        label: 'SpacetimeDB Sync',
        desc: 'Results logged via add_task() and update_task_status() — frontend auto-updates over WebSocket',
        color: '#f59e0b',
        statusMatch: ['completed'],
    },
];
function Step({ step, active, done, blocked, index, total, }) {
    const stateColor = blocked
        ? '#ef4444'
        : done
            ? step.color
            : active
                ? step.color
                : '#1e293b';
    const textColor = blocked
        ? '#fca5a5'
        : done || active
            ? '#e2e8f0'
            : '#334155';
    return (_jsxs("div", { style: { display: 'flex', gap: 0 }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }, children: [_jsx("div", { style: {
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
                        }, children: blocked ? (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "#ef4444", strokeWidth: "2.5", children: _jsx("path", { d: "M6 18L18 6M6 6l12 12" }) })) : done ? (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: step.color, strokeWidth: "2.5", children: _jsx("path", { d: "M5 13l4 4L19 7" }) })) : active ? (_jsx("div", { style: { width: 8, height: 8, borderRadius: '50%', background: step.color, animation: 'pulse 1.5s ease-in-out infinite' } })) : (_jsx("span", { style: { fontSize: '.65rem', color: '#334155', fontWeight: 700 }, children: index + 1 })) }), index < total - 1 && (_jsx("div", { style: { width: 2, flex: 1, minHeight: 36, background: done ? `linear-gradient(to bottom, ${step.color}55, ${step.color}22)` : 'rgba(30,41,59,.8)', transition: 'background .5s' } }))] }), _jsx("div", { style: { flex: 1, paddingBottom: index < total - 1 ? 28 : 0, paddingLeft: 14 }, children: _jsxs("div", { style: {
                        padding: '14px 18px',
                        borderRadius: 10,
                        border: `1px solid ${done || active || blocked ? stateColor + '40' : 'rgba(30,41,59,.8)'}`,
                        background: done || active ? `${stateColor}0a` : 'rgba(12,16,32,.7)',
                        transition: 'all .4s',
                    }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: '.87rem', fontWeight: 700, color: textColor, transition: 'color .4s' }, children: step.label }), blocked && (_jsx("span", { className: "badge badge-red", children: "BLOCKED" })), done && !blocked && (_jsx("span", { className: "badge badge-green", children: "Done" })), active && !done && !blocked && (_jsx("span", { className: "badge badge-blue", children: "In Progress" }))] }), _jsx("p", { style: { margin: 0, fontSize: '.78rem', color: '#475569', lineHeight: 1.5 }, children: step.desc })] }) })] }));
}
function TaskPipelineCard({ task }) {
    const isBlocked = task.status === 'blocked';
    const isCompleted = task.status === 'completed';
    const isProcessing = task.status === 'processing';
    const activeStepIdx = isBlocked
        ? 3
        : isCompleted
            ? 5
            : isProcessing
                ? Math.floor((task.progress / 100) * STEPS.length)
                : 0;
    return (_jsxs("div", { className: "glass-card", style: { padding: 24 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }, children: [_jsxs("div", { children: [_jsx("p", { style: { margin: '0 0 4px', fontFamily: 'JetBrains Mono, monospace', fontSize: '.72rem', color: '#475569' }, children: task.id }), _jsx("p", { className: "line-clamp-2", style: { margin: 0, fontSize: '.9rem', fontWeight: 600, color: '#e2e8f0', maxWidth: 400 }, children: task.user_request })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }, children: [_jsx("span", { className: `badge ${isBlocked ? 'badge-red' : isCompleted ? 'badge-green' : isProcessing ? 'badge-blue' : 'badge-purple'}`, children: task.status }), _jsxs("span", { style: { fontSize: '.72rem', color: '#475569' }, children: [Math.round(task.progress || 0), "%"] })] })] }), _jsx("div", { children: STEPS.map((step, i) => (_jsx(Step, { step: step, index: i, total: STEPS.length, done: i < activeStepIdx && !isBlocked, active: i === activeStepIdx, blocked: isBlocked && i === 3 }, step.id))) })] }));
}
export default function TaskFlow({ tasks }) {
    const activeTasks = tasks.filter(t => t.status !== 'queued');
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 24 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { children: [_jsx("h2", { style: { margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }, children: "Task Execution Pipeline" }), _jsx("p", { style: { margin: 0, fontSize: '.8rem', color: '#475569' }, children: "6-step pipeline: ArmorIQ verification, policy enforcement, agent execution, and SpacetimeDB sync" })] }), _jsxs("span", { className: "badge badge-slate", children: [activeTasks.length, " active"] })] }), _jsx("div", { style: { display: 'flex', gap: 16, flexWrap: 'wrap' }, children: [
                    { color: '#6366f1', label: 'Pending' },
                    { color: '#06b6d4', label: 'Active' },
                    { color: '#10b981', label: 'Done' },
                    { color: '#ef4444', label: 'Blocked' },
                ].map(l => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: '#64748b' }, children: [_jsx("div", { style: { width: 10, height: 10, borderRadius: '50%', background: l.color } }), l.label] }, l.label))) }), activeTasks.length === 0 ? (_jsxs("div", { className: "glass-card", style: { padding: 60, textAlign: 'center' }, children: [_jsx("div", { style: { width: 52, height: 52, borderRadius: 14, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }, children: _jsxs("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "#6366f1", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }) }), _jsx("p", { style: { color: '#475569', margin: 0, fontWeight: 500 }, children: "Waiting for tasks" }), _jsx("p", { style: { color: '#334155', fontSize: '.8rem', margin: '4px 0 0' }, children: "Submit a request from the Dashboard to see the pipeline" })] })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 24 }, children: activeTasks.map(task => _jsx(TaskPipelineCard, { task: task }, task.id)) }))] }));
}
