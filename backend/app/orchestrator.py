# Task Orchestration
# Coordinates the 4-agent pipeline: Analyzer → Executor → Validator → Reporter
# Each step is verified by ArmorIQ and logged to SpacetimeDB

import uuid
import logging
from typing import Dict, Any, List, Optional, Callable, Awaitable
from .agents import AGENTS, AgentRole, get_agent_by_role

logger = logging.getLogger(__name__)

# Type for the broadcast function injected from main.py
BroadcastFn = Callable[[Dict[str, Any]], Awaitable[None]]


class TaskOrchestrator:
    """
    Orchestrates multi-agent task execution with progress tracking.

    Pipeline:
      1. Analyzer  — understands and decomposes the request (Ollama - fast)
      2. Executor  — carries out the actions (Gemini Flash - accurate)
      3. Validator — checks results for correctness & compliance (Ollama - fast)
      4. Reporter  — formats output for the user (Gemini Flash - accurate)

    Real-time synchronization:
      - Broadcasts agent_update with progress (0-100%)
      - Broadcasts task_progress for TaskFlow visualization
      - Logs to SpacetimeDB for persistence
    """

    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self._broadcast: Optional[BroadcastFn] = None
        self.task_progress: Dict[str, int] = {}  # Track progress per task

    def set_broadcast(self, fn: BroadcastFn) -> None:
        """Inject the WebSocket broadcast function from main.py."""
        self._broadcast = fn

    async def _broadcast_agent(self, agent_id: str, status: str, task_id: str) -> None:
        """Emit an agent_update WebSocket message."""
        if not self._broadcast:
            return
        agent = AGENTS.get(agent_id)
        if not agent:
            return
        await self._broadcast({
            "type": "agent_update",
            "agent": agent.get_status(),
        })

    async def _broadcast_log(self, level: str, message: str, task_id: str) -> None:
        if not self._broadcast:
            return
        await self._broadcast({
            "type": "log",
            "level": level,
            "message": message,
            "task_id": task_id,
        })

    async def _broadcast_progress(self, task_id: str, progress: int, step: str) -> None:
        """Broadcast task progress for TaskFlow visualization (0-100%)"""
        if not self._broadcast:
            return
        self.task_progress[task_id] = progress
        await self._broadcast({
            "type": "task_progress",
            "task_id": task_id,
            "progress": progress,
            "step": step,
            "status": "processing"
        })

    async def _run_agent_step(
        self,
        role: str,
        task_id: str,
        description: str,
        original_request: str,
        context: str = "",
    ) -> Dict[str, Any]:
        """
        Run a single agent step:
          1. Set agent status → working  (broadcast + SpacetimeDB)
          2. Call Ollama via agent.process()
          3. Set agent status → idle     (broadcast + SpacetimeDB)
          4. Return result
        """
        agent = get_agent_by_role(role)
        if not agent:
            return {"status": "error", "error": f"No agent for role: {role}"}

        # Mark working
        agent.status = "working"
        agent.last_task_id = task_id
        agent.execution_count += 1
        await self._broadcast_agent(role, "working", task_id)
        await self._broadcast_log(
            "info",
            f"[{agent.name}] starting — {description[:80]}",
            task_id,
        )

        try:
            result = await agent.process({
                "action_id": f"{role}-{uuid.uuid4().hex[:6]}",
                "description": description,
                "original_request": original_request,
                "context": context,
            })
            agent.status = "idle"
            await self._broadcast_agent(role, "idle", task_id)
            await self._broadcast_log(
                "success",
                f"[{agent.name}] completed — {result.get('output', '')[:120]}",
                task_id,
            )
            return result

        except Exception as e:
            agent.status = "error"
            await self._broadcast_agent(role, "error", task_id)
            await self._broadcast_log("error", f"[{agent.name}] error: {e}", task_id)
            return {"status": "error", "error": str(e)}

    async def orchestrate(
        self,
        task_id: str,
        user_request: str,
        tool_plan: List[str],
        db=None,
    ) -> Dict[str, Any]:
        """
        Run the full 4-agent pipeline with multi-provider synchronization.

        Pipeline:
          1. Analyzer   (Ollama - fast)   [25% progress]
          2. Executor   (Gemini - accurate) [50% progress]
          3. Validator  (Ollama - fast)   [75% progress]
          4. Reporter   (Gemini - accurate) [100% progress]

        Args:
            task_id:      Unique task identifier
            user_request: Original user request string
            tool_plan:    List of tool names from ArmorIQ
            db:           SpacetimeDB instance for persistence
        """
        results: Dict[str, Any] = {}
        total_tokens = 0

        # ── Step 1: Analyzer (Ollama - fast) ─────────────────────────────────
        await self._broadcast_progress(task_id, 0, "analyzer")
        await self._broadcast_log("info", f"Step 1/4: Analyzer (Ollama - fast analysis)", task_id)
        analysis = await self._run_agent_step(
            role="analyzer",
            task_id=task_id,
            description=(
                f"Analyze this request and identify what needs to be done. "
                f"Tool plan approved: {', '.join(tool_plan)}. "
                f"Request: {user_request}"
            ),
            original_request=user_request,
        )
        await self._broadcast_progress(task_id, 25, "analyzer")
        if db:
            await db.log_action(task_id, "agent-001", "analyze",
                                {"output": analysis.get("output", "")[:500]})
        results["analysis"] = analysis
        if analysis.get("tokens_used"):
            total_tokens += sum(analysis["tokens_used"].values())

        # ── Step 2: Executor (Gemini - accurate) ────────────────────────────
        await self._broadcast_progress(task_id, 25, "executor")
        await self._broadcast_log("info", f"Step 2/4: Executor (Gemini Flash - accurate execution)", task_id)
        execution = await self._run_agent_step(
            role="executor",
            task_id=task_id,
            description=(
                f"Execute the actions identified by the Analyzer. "
                f"Analysis: {analysis.get('output', 'N/A')[:300]}"
            ),
            original_request=user_request,
            context=analysis.get("output", ""),
        )
        await self._broadcast_progress(task_id, 50, "executor")
        if db:
            await db.log_action(task_id, "agent-002", "execute",
                                {"output": execution.get("output", "")[:500]})
        results["execution"] = execution
        if execution.get("tokens_used"):
            total_tokens += sum(execution["tokens_used"].values())

        # ── Step 3: Validator (Ollama - fast) ───────────────────────────────
        await self._broadcast_progress(task_id, 50, "validator")
        await self._broadcast_log("info", f"Step 3/4: Validator (Ollama - fast verification)", task_id)
        validation = await self._run_agent_step(
            role="validator",
            task_id=task_id,
            description=(
                f"Validate the execution results for correctness and security compliance. "
                f"Execution output: {execution.get('output', 'N/A')[:300]}"
            ),
            original_request=user_request,
            context=execution.get("output", ""),
        )
        await self._broadcast_progress(task_id, 75, "validator")
        if db:
            await db.log_action(task_id, "agent-003", "validate",
                                {"output": validation.get("output", "")[:500]})
        results["validation"] = validation
        if validation.get("tokens_used"):
            total_tokens += sum(validation["tokens_used"].values())

        # ── Step 4: Reporter (Gemini - accurate) ────────────────────────────
        await self._broadcast_progress(task_id, 75, "reporter")
        await self._broadcast_log("info", f"Step 4/4: Reporter (Gemini Flash - accurate reporting)", task_id)
        report = await self._run_agent_step(
            role="reporter",
            task_id=task_id,
            description=(
                f"Generate a clear, structured report for the user based on: "
                f"Analysis: {analysis.get('output', '')[:200]} | "
                f"Execution: {execution.get('output', '')[:200]} | "
                f"Validation: {validation.get('output', '')[:200]}"
            ),
            original_request=user_request,
        )
        await self._broadcast_progress(task_id, 100, "reporter")
        if db:
            await db.log_action(task_id, "agent-004", "report",
                                {"output": report.get("output", "")[:500]})
        results["report"] = report
        if report.get("tokens_used"):
            total_tokens += sum(report["tokens_used"].values())

        # ── Persist final result ─────────────────────────────────────────────
        final_status = "error" if any(
            r.get("status") == "error" for r in results.values()
        ) else "completed"

        await self._broadcast_progress(task_id, 100, "completed")

        if db:
            await db.set_result(
                task_id=task_id,
                status="success" if final_status == "completed" else "failed",
                output={
                    "analysis": analysis.get("output", "")[:1000],
                    "execution": execution.get("output", "")[:1000],
                    "validation": validation.get("output", "")[:1000],
                    "report": report.get("output", "")[:2000],
                },
                verification_status="passed",
                tokens_used=total_tokens,
            )

        return {
            "task_id": task_id,
            "status": final_status,
            "results": results,
            "total_tokens": total_tokens,
            "report": report.get("output", ""),
        }

    async def create_task(self, task_id: str, user_request: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Register a task in the orchestrator."""
        task = {
            "id": task_id,
            "status": "created",
            "user_request": user_request,
            "context": context,
            "results": {},
        }
        self.tasks[task_id] = task
        return task

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        return self.tasks.get(task_id, {})


# Global orchestrator instance
orchestrator = TaskOrchestrator()
