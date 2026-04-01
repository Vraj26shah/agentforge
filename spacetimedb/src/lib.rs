use spacetimedb::{reducer, table, Identity, ReducerContext, Table, Timestamp};

// ─── Tables ───────────────────────────────────────────────────────────────────

#[table(name = task, public)]
pub struct Task {
    #[primary_key]
    pub id: String,
    pub user_request: String,
    pub status: String,          // created | queued | processing | completed | blocked | error
    pub plan_id: Option<String>,
    pub blocked_reason: Option<String>,
    pub tool_plan: String,       // JSON array
    pub progress: u32,           // 0-100
    pub created_at: u64,         // Unix ms
    pub updated_at: u64,
}

#[table(name = agent_status, public)]
pub struct AgentStatus {
    #[primary_key]
    pub id: String,
    pub name: String,
    pub role: String,            // analyzer | executor | validator | reporter
    pub status: String,          // idle | working | error
    pub last_task_id: Option<String>,
    pub execution_count: u32,
    pub capabilities: String,    // JSON array
    pub updated_at: u64,
}

#[table(name = action, public)]
pub struct Action {
    #[primary_key]
    pub id: String,
    pub task_id: String,
    pub agent_id: String,
    pub action_type: String,
    pub details: Option<String>, // JSON
    pub timestamp: u64,
}

#[table(name = security_event, public)]
pub struct SecurityEvent {
    #[primary_key]
    pub id: String,
    pub task_id: String,
    pub event_type: String,      // verification_failed | policy_violation | token_expired | other
    pub severity: String,        // info | warning | blocked
    pub details: Option<String>,
    pub timestamp: u64,
}

#[table(name = task_result, public)]
pub struct TaskResult {
    #[primary_key]
    pub id: String,
    pub task_id: String,
    pub status: String,          // success | failed | blocked
    pub output: Option<String>,  // JSON
    pub verification_status: String,
    pub tokens_used: u32,
    pub completed_at: u64,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn now_ms() -> u64 {
    Timestamp::now().micros_since_unix_epoch / 1_000
}

// ─── Reducers ────────────────────────────────────────────────────────────────

#[reducer]
pub fn create_task(
    ctx: &ReducerContext,
    id: String,
    user_request: String,
    tool_plan: String,
    plan_id: Option<String>,
) {
    let now = now_ms();
    ctx.db.task().insert(Task {
        id,
        user_request,
        status: "queued".to_string(),
        plan_id,
        blocked_reason: None,
        tool_plan,
        progress: 0,
        created_at: now,
        updated_at: now,
    });
}

#[reducer]
pub fn update_task_status(
    ctx: &ReducerContext,
    id: String,
    status: String,
    progress: u32,
    blocked_reason: Option<String>,
) {
    let now = now_ms();
    if let Some(mut task) = ctx.db.task().id().find(&id) {
        task.status = status;
        task.progress = progress;
        task.blocked_reason = blocked_reason;
        task.updated_at = now;
        ctx.db.task().id().update(task);
    }
}

#[reducer]
pub fn upsert_agent(
    ctx: &ReducerContext,
    id: String,
    name: String,
    role: String,
    status: String,
    last_task_id: Option<String>,
    execution_count: u32,
    capabilities: String,
) {
    let now = now_ms();
    if let Some(mut agent) = ctx.db.agent_status().id().find(&id) {
        agent.status = status;
        agent.last_task_id = last_task_id;
        agent.execution_count = execution_count;
        agent.updated_at = now;
        ctx.db.agent_status().id().update(agent);
    } else {
        ctx.db.agent_status().insert(AgentStatus {
            id,
            name,
            role,
            status,
            last_task_id,
            execution_count,
            capabilities,
            updated_at: now,
        });
    }
}

#[reducer]
pub fn log_action(
    ctx: &ReducerContext,
    id: String,
    task_id: String,
    agent_id: String,
    action_type: String,
    details: Option<String>,
) {
    ctx.db.action().insert(Action {
        id,
        task_id,
        agent_id,
        action_type,
        details,
        timestamp: now_ms(),
    });
}

#[reducer]
pub fn log_security_event(
    ctx: &ReducerContext,
    id: String,
    task_id: String,
    event_type: String,
    severity: String,
    details: Option<String>,
) {
    ctx.db.security_event().insert(SecurityEvent {
        id,
        task_id,
        event_type,
        severity,
        details,
        timestamp: now_ms(),
    });
}

#[reducer]
pub fn set_result(
    ctx: &ReducerContext,
    id: String,
    task_id: String,
    status: String,
    output: Option<String>,
    verification_status: String,
    tokens_used: u32,
) {
    ctx.db.task_result().insert(TaskResult {
        id,
        task_id,
        status,
        output,
        verification_status,
        tokens_used,
        completed_at: now_ms(),
    });
}
