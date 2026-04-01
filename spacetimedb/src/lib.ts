// AgentForge SpacetimeDB Schema & Queries
// Defines the database structure for real-time synchronization

import { Table, PrimaryKey, Index } from "@spacetimedb";

// Task definition
@Table("tasks")
export class Task {
  @PrimaryKey id: string;
  user_request: string;
  status: "created" | "queued" | "processing" | "completed" | "blocked";
  created_at: number; // Unix timestamp
  updated_at: number;
  context?: string; // JSON serialized context
  result?: string; // JSON serialized result
}

// Agent definition
@Table("agents")
export class Agent {
  @PrimaryKey id: string;
  name: string;
  role: "analyzer" | "executor" | "validator" | "reporter";
  model: string;
  capabilities: string[]; // JSON serialized
  status: "idle" | "working" | "error";
}

// Agent actions - log of what each agent does
@Table("actions")
export class Action {
  @PrimaryKey id: string;
  task_id: string;
  agent_id: string;
  action_type: string;
  details?: string; // JSON serialized
  timestamp: number;
}

// Security events - audit trail
@Table("security_events")
export class SecurityEvent {
  @PrimaryKey id: string;
  task_id: string;
  event_type: "verification_failed" | "token_limit_exceeded" | "policy_violation" | "other";
  details?: string;
  timestamp: number;
}

// Results - final task results
@Table("results")
export class Result {
  @PrimaryKey id: string;
  task_id: string;
  status: "success" | "failed" | "blocked";
  output?: string;
  verification_status: string;
  completed_at: number;
}

// Create a new task
export function create_task(id: string, user_request: string, context?: string) {
  const now = Date.now();
  Task.insert(new Task({
    id,
    user_request,
    status: "created",
    created_at: now,
    updated_at: now,
    context,
  }));
}

// Update task status
export function update_task_status(task_id: string, status: string) {
  const task = Task.findByPrimaryKey(task_id);
  if (task) {
    task.status = status as any;
    task.updated_at = Date.now();
    task.update();
  }
}

// Log an agent action
export function log_action(
  id: string,
  task_id: string,
  agent_id: string,
  action_type: string,
  details?: string
) {
  Action.insert(new Action({
    id,
    task_id,
    agent_id,
    action_type,
    details,
    timestamp: Date.now(),
  }));
}

// Log a security event
export function log_security_event(
  id: string,
  task_id: string,
  event_type: string,
  details?: string
) {
  SecurityEvent.insert(new SecurityEvent({
    id,
    task_id,
    event_type: event_type as any,
    details,
    timestamp: Date.now(),
  }));
}

// Set task result
export function set_result(
  id: string,
  task_id: string,
  status: string,
  output?: string,
  verification_status: string = "unknown"
) {
  Result.insert(new Result({
    id,
    task_id,
    status: status as any,
    output,
    verification_status,
    completed_at: Date.now(),
  }));
}

// Query functions
export function get_task(id: string): Task | undefined {
  return Task.findByPrimaryKey(id);
}

export function get_tasks_by_status(status: string): Task[] {
  return Task.filter((t) => t.status === status);
}

export function get_active_agents(): Agent[] {
  return Agent.filter((a) => a.status === "idle" || a.status === "working");
}

export function get_task_actions(task_id: string): Action[] {
  return Action.filter((a) => a.task_id === task_id);
}

export function get_task_security_events(task_id: string): SecurityEvent[] {
  return SecurityEvent.filter((e) => e.task_id === task_id);
}
