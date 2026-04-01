import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import TaskFlow from './components/TaskFlow';
import AgentBoard from './components/AgentBoard';
import DebugLog from './components/DebugLog';
import WorkflowVisualization from './components/WorkflowVisualization';
const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'flow', label: 'Task Flow', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'agents', label: 'Agents', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'workflow', label: 'Architecture', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
    { id: 'debug', label: 'Live Logs', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
];
export default function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [tasks, setTasks] = useState([]);
    const [agents, setAgents] = useState([]);
    const [logs, setLogs] = useState([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const addLog = useCallback((type, message, taskId) => {
        setLogs(prev => [{
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                type,
                message,
                task_id: taskId,
            }, ...prev].slice(0, 200));
    }, []);
    // WebSocket
    useEffect(() => {
        let ws = null;
        let retryTimer;
        const connect = () => {
            try {
                // Use the current host to connect to backend
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.hostname;
                const backendUrl = `${protocol}//${host}:8000/ws/updates`;
                console.log('Connecting WebSocket to:', backendUrl);
                ws = new WebSocket(backendUrl);
                ws.onopen = () => {
                    setConnected(true);
                    setError(null);
                    addLog('success', 'WebSocket connected to backend');
                    console.log('WebSocket connected');
                };
                ws.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        if (data.type === 'task_update') {
                            setTasks(prev => {
                                const exists = prev.find(t => t.id === data.task.id);
                                return exists
                                    ? prev.map(t => t.id === data.task.id ? { ...t, ...data.task } : t)
                                    : [...prev, data.task];
                            });
                            addLog('info', `Task ${data.task.id} — ${data.task.status}`, data.task.id);
                        }
                        if (data.type === 'agent_update') {
                            setAgents(prev => {
                                const exists = prev.find(a => a.id === data.agent.id);
                                return exists
                                    ? prev.map(a => a.id === data.agent.id ? { ...a, ...data.agent } : a)
                                    : [...prev, data.agent];
                            });
                        }
                        if (data.type === 'security_event') {
                            addLog(data.severity === 'blocked' ? 'error' : 'security', data.message, data.task_id);
                        }
                        if (data.type === 'log') {
                            addLog(data.level || 'info', data.message, data.task_id);
                        }
                    }
                    catch { /* ignore parse errors */ }
                };
                ws.onerror = (ev) => {
                    console.error('WebSocket error:', ev);
                    setConnected(false);
                    setError('WebSocket connection error');
                    addLog('error', 'WebSocket connection error');
                };
                ws.onclose = () => {
                    setConnected(false);
                    addLog('warning', 'WebSocket disconnected — retrying in 3s');
                    retryTimer = setTimeout(connect, 3000);
                };
            }
            catch (e) {
                console.error('Failed to establish WebSocket connection:', e);
                setError(`WebSocket error: ${e}`);
                addLog('error', `Failed to establish WebSocket connection: ${e}`);
            }
        };
        connect();
        return () => {
            clearTimeout(retryTimer);
            ws?.close();
        };
    }, [addLog]);
    // Poll agents
    useEffect(() => {
        const fetch_ = () => {
            const host = window.location.hostname;
            return fetch(`http://${host}:8000/api/agents`)
                .then(r => r.json())
                .then(d => {
                setAgents(d.agents || []);
                setError(null);
            })
                .catch((e) => {
                console.error('Failed to fetch agents:', e);
                setError(`Failed to connect to backend: ${e.message}`);
            });
        };
        fetch_();
        const t = setInterval(fetch_, 5000);
        return () => clearInterval(t);
    }, []);
    const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
        active: agents.filter(a => a.status === 'working').length,
        agents: agents.length,
        logCount: logs.length,
    };
    // Non-blocking backend notice (shown as a banner inside the layout, not a full-screen error)
    return (_jsxs("div", { style: { minHeight: '100vh', background: 'var(--bg-base)' }, children: [_jsx("header", { style: {
                    background: 'linear-gradient(180deg, rgba(10,14,28,.98) 0%, rgba(8,11,22,.95) 100%)',
                    borderBottom: '1px solid rgba(99,102,241,.15)',
                    paddingBottom: '0',
                }, children: _jsxs("div", { style: { maxWidth: 1400, margin: '0 auto', padding: '22px 32px 0' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, children: [_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }, children: [_jsx("div", { style: {
                                                        width: 38, height: 38, borderRadius: 10,
                                                        background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: '0 4px 16px rgba(99,102,241,.4)',
                                                    }, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" }) }) }), _jsx("h1", { style: { margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.02em' }, children: _jsx("span", { className: "gradient-text", children: "AgentForge" }) }), _jsx("span", { className: "badge badge-purple", style: { marginTop: 2 }, children: "v0.1.0" })] }), _jsx("p", { style: { margin: 0, fontSize: '.825rem', color: '#64748b', letterSpacing: '.01em' }, children: "Multi-Agent AI Orchestration Platform \u2014 ArmorIQ Intent Verification + SpacetimeDB Real-time Sync" })] }), _jsxs("div", { style: {
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 16px',
                                        background: connected ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
                                        border: `1px solid ${connected ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}`,
                                        borderRadius: 8,
                                    }, children: [_jsx("div", { className: connected ? 'dot-live' : 'dot-dead' }), _jsx("span", { style: { fontSize: '.8rem', fontWeight: 600, color: connected ? '#6ee7b7' : '#fca5a5' }, children: connected ? 'Live' : 'Offline' }), _jsx("span", { style: { fontSize: '.75rem', color: '#475569' }, children: "ws://backend:8000" })] })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, margin: '20px 0 0' }, children: [
                                { label: 'Total Tasks', value: stats.total, color: '#93c5fd' },
                                { label: 'Completed', value: stats.completed, color: '#6ee7b7' },
                                { label: 'Blocked', value: stats.blocked, color: '#fca5a5' },
                                { label: 'Active Agents', value: `${stats.active}/${stats.agents}`, color: '#c4b5fd' },
                                { label: 'Log Entries', value: stats.logCount, color: '#fde68a' },
                                { label: 'LLM Engine', value: 'Ollama', color: '#67e8f9', isText: true },
                            ].map(s => (_jsxs("div", { className: "stat-pill", children: [_jsx("span", { style: { fontSize: '.68rem', fontWeight: 600, color: '#475569', letterSpacing: '.06em', textTransform: 'uppercase' }, children: s.label }), _jsx("span", { style: { fontSize: '1.35rem', fontWeight: 800, color: s.color }, children: s.value })] }, s.label))) }), _jsx("nav", { style: { display: 'flex', gap: 2, marginTop: 18, overflowX: 'auto' }, children: TABS.map(tab => (_jsxs("button", { className: `nav-tab${activeTab === tab.id ? ' active' : ''}`, onClick: () => setActiveTab(tab.id), style: { background: 'none', border: 'none' }, children: [_jsx("svg", { className: "nav-icon", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: tab.icon }) }), tab.label] }, tab.id))) })] }) }), _jsxs("main", { style: { maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }, children: [activeTab === 'dashboard' && _jsx(Dashboard, { tasks: tasks, agents: agents, onTaskSubmit: () => { }, onTaskCreated: (t) => setTasks([t, ...tasks]) }), activeTab === 'flow' && _jsx(TaskFlow, { tasks: tasks }), activeTab === 'agents' && _jsx(AgentBoard, { agents: agents }), activeTab === 'workflow' && _jsx(WorkflowVisualization, { tasks: tasks }), activeTab === 'debug' && _jsx(DebugLog, { logs: logs })] })] }));
}
