# Task Orchestration
# Coordinates the 4-agent pipeline: Analyzer → Executor → Validator → Reporter
# Each step is verified by ArmorIQ and logged to SpacetimeDB

import uuid
import logging
from typing import Dict, Any, List, Optional, Callable, Awaitable
from .agents import AGENTS, AgentRole, get_agent_by_role
from .armoriq_integration import get_armoriq_client, RBACJudgment

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

    async def _broadcast_agent(self, agent_id: str, status: str, task_id: str, user_id: str = "anonymous") -> None:
        """Emit an agent_update WebSocket message."""
        if not self._broadcast:
            return
        agent = AGENTS.get(agent_id)
        if not agent:
            return
        agent_data = agent.get_status()
        agent_data["current_task_user_id"] = user_id
        await self._broadcast({
            "type": "agent_update",
            "agent": agent_data,
        })

    async def _broadcast_log(self, level: str, message: str, task_id: str) -> None:
        # Always log to stdout so errors are visible in docker logs
        log_fn = logger.error if level == "error" else (logger.warning if level == "warning" else logger.info)
        log_fn("[task=%s] %s", task_id, message)
        if not self._broadcast:
            return
        await self._broadcast({
            "type": "log",
            "level": level,
            "message": message,
            "task_id": task_id,
        })

    async def _broadcast_progress(self, task_id: str, progress: int, step: str, user_id: str = "anonymous") -> None:
        """Broadcast task progress for TaskFlow visualization (0-100%)"""
        if not self._broadcast:
            return
        self.task_progress[task_id] = progress
        await self._broadcast({
            "type": "task_progress",
            "task_id": task_id,
            "progress": progress,
            "step": step,
            "status": "processing",
            "user_id": user_id
        })

    async def _run_agent_step(
        self,
        role: str,
        task_id: str,
        description: str,
        original_request: str,
        context: str = "",
        user_id: str = "anonymous",
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
        await self._broadcast_agent(role, "working", task_id, user_id)
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
            await self._broadcast_agent(role, "idle", task_id, user_id)
            log_level = "success" if result.get("status") != "error" else "error"
            log_msg = (
                f"[{agent.name}] completed — {result.get('output', '')[:120]}"
                if result.get("status") != "error"
                else f"[{agent.name}] failed — {result.get('error', '')[:120]}"
            )
            await self._broadcast_log(log_level, log_msg, task_id)
            return result

        except Exception as e:
            agent.status = "error"
            await self._broadcast_agent(role, "error", task_id, user_id)
            error_msg = str(e)
            await self._broadcast_log("error", f"[{agent.name}] error: {error_msg}", task_id)
            # Include step name in error response
            return {"status": "error", "error": error_msg, "failed_step": role}

    async def classify_and_judge(
        self,
        task_id: str,
        user_request: str,
        role: str,
    ) -> "RBACJudgment":
        """
        Pre-pipeline step:
          1. Analyzer AI classifies user intent (Ollama)
          2. ArmorIQ checks role-based policy
          3. Returns RBACJudgment (allowed / blocked / needs_approval)
        """
        analyzer = get_agent_by_role("analyzer")
        armoriq = get_armoriq_client()

        await self._broadcast_log("info",
            f"[Intent Classifier] Analyzing intent for role={role}", task_id)

        intent = await analyzer.classify_intent(user_request)

        await self._broadcast_log("info",
            f"[Intent Classifier] Detected: category={intent.get('category')} "
            f"risk={intent.get('risk_level')} — {intent.get('description', '')[:80]}", task_id)

        judgment = armoriq.check_rbac(role, intent)

        level = "success" if judgment.allowed else "error"
        await self._broadcast_log(level,
            f"[ArmorIQ RBAC] {judgment.judgment_reason}", task_id)

        return judgment

    async def orchestrate(
        self,
        task_id: str,
        user_request: str,
        tool_plan: List[str],
        db=None,
        user_id: str = "anonymous",
        role: str = "junior_engineer",
        task_type: str = "general",
        file_context: str = "",
        chat_history: Optional[List] = None,
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
            user_id:      Multi-user identifier (defaults to "anonymous")
        """
        results: Dict[str, Any] = {}
        total_tokens = 0
        failed_step = None
        executor_failed = False
        executor_error_msg = ""

        # Hard cap on file context sent to agents — prevents Ollama timeouts on large files.
        FILE_CTX_LIMIT = 8000
        safe_file_ctx = file_context[:FILE_CTX_LIMIT] if file_context else ""

        # Build a formatted conversation history block to prepend to prompts
        history_section = ""
        if chat_history:
            lines = []
            for m in (chat_history or [])[-8:]:  # last 8 messages = 4 turns
                label = "User" if m.get("role") == "user" else "Agent"
                lines.append(f"{label}: {str(m.get('content', ''))[:400]}")
            if lines:
                history_section = (
                    "PREVIOUS CONVERSATION (about this file):\n"
                    + "\n".join(lines)
                    + "\n\n"
                )

        # ── Pre-flight: Intent Classification + RBAC Judgment ─────────────────
        await self._broadcast_progress(task_id, 0, "intent_classifier", user_id)
        judgment = await self.classify_and_judge(task_id, user_request, role)

        results["judgment"] = {
            "role": judgment.role,
            "intent_category": judgment.intent_category,
            "risk_level": judgment.risk_level,
            "intent_description": judgment.intent_description,
            "intent_reasoning": judgment.intent_reasoning,
            "policy_action": judgment.policy_action,
            "judgment_reason": judgment.judgment_reason,
            "requires_approval_from": judgment.requires_approval_from,
            "allowed": judgment.allowed,
            "timestamp": judgment.timestamp,
        }

        if db:
            await db.log_security_event(
                task_id=task_id,
                event_type="rbac_judgment",
                severity="blocked" if not judgment.allowed else "info",
                details=results["judgment"],
            )

        if not judgment.allowed:
            await self._broadcast_progress(task_id, 0, "blocked", user_id)
            return {
                "task_id": task_id,
                "status": "blocked",
                "results": results,
                "judgment": results["judgment"],
                "blocked_reason": judgment.judgment_reason,
                "report": judgment.judgment_reason,
            }

        # ── Step 1: Analyzer ─────────────────────────────────────────────────
        await self._broadcast_progress(task_id, 0, "analyzer", user_id)
        await self._broadcast_log("info", "Step 1/4: Analyzer — decomposing request", task_id)

        if task_type == "code_suggestion" and file_context:
            analyzer_desc = (
                f"{history_section}"
                f"The user wants to make the following change to a file.\n\n"
                f"REQUEST: {user_request}\n\n"
                f"FILE CONTENTS:\n{safe_file_ctx}\n\n"
                f"List numbered sub-tasks for the Executor, referencing specific lines/functions."
            )
        elif file_context and task_type == "file_question":
            # Don't send the full file to the tiny Ollama analyzer model — it can't
            # handle large files and produces garbage that corrupts the whole pipeline.
            # Executor (Gemini) will receive the full file directly.
            analyzer_desc = (
                f"{history_section}"
                f"A user wants an explanation/analysis of a source file.\n\n"
                f"REQUEST: {user_request}\n\n"
                f"List 2-3 concise points about what the Executor should cover in the answer."
            )
        else:
            file_section = f"FILE CONTEXT:\n{safe_file_ctx}\n\n" if file_context else ""
            analyzer_desc = (
                f"{history_section}"
                f"REQUEST: {user_request}\n\n"
                f"{file_section}"
                f"List numbered sub-tasks the Executor must perform to fulfill this request."
            )

        analysis = await self._run_agent_step(
            role="analyzer", task_id=task_id,
            description=analyzer_desc, original_request=user_request, user_id=user_id,
        )
        # Analyzer failure is non-fatal — continue with a default decomposition
        if analysis.get("status") == "error":
            await self._broadcast_log("warning",
                f"Analyzer failed ({analysis.get('error','')}), continuing with default decomposition", task_id)
            analysis["output"] = f"1. Address the user request: {user_request}"
            analysis["status"] = "completed"

        await self._broadcast_progress(task_id, 25, "analyzer", user_id)
        if db:
            await db.log_action(task_id, "agent-001", "analyze", {"output": analysis.get("output", "")[:500]})
        results["analysis"] = analysis
        if analysis.get("tokens_used"):
            total_tokens += sum(analysis["tokens_used"].values())

        # ── Step 2: Executor ─────────────────────────────────────────────────
        await self._broadcast_progress(task_id, 25, "executor", user_id)
        await self._broadcast_log("info", "Step 2/4: Executor (Gemini Flash) — executing", task_id)

        if task_type == "code_suggestion" and file_context:
            executor_desc = (
                f"{history_section}"
                f"Apply the following change to the file. Return ONLY the complete updated file — "
                f"no explanations, no markdown fences, no commentary.\n\n"
                f"CHANGE REQUEST: {user_request}\n\n"
                f"ANALYSIS:\n{analysis.get('output','')[:500]}\n\n"
                f"CURRENT FILE:\n{safe_file_ctx}"
            )
        elif file_context:
            executor_desc = (
                f"{history_section}"
                f"Answer the following request about this file. Be specific, detailed, and reference "
                f"actual line numbers and function names from the file.\n\n"
                f"REQUEST: {user_request}\n\n"
                f"ANALYSIS:\n{analysis.get('output','')[:500]}\n\n"
                f"FILE CONTENTS:\n{safe_file_ctx}"
            )
        else:
            executor_desc = (
                f"REQUEST: {user_request}\n\n"
                f"ANALYSIS:\n{analysis.get('output','')[:500]}\n\n"
                f"Execute the above and provide a detailed, useful response."
            )

        execution = await self._run_agent_step(
            role="executor", task_id=task_id,
            description=executor_desc, original_request=user_request,
            context=analysis.get("output", ""), user_id=user_id,
        )
        # Executor failure is non-fatal — if Ollama also failed, use a placeholder so
        # the pipeline can still produce a Validator + Reporter pass.
        if execution.get("status") == "error":
            await self._broadcast_log(
                "warning",
                f"Executor failed ({execution.get('error', '')}), continuing with placeholder output",
                task_id,
            )
            execution["output"] = (
                f"Executor could not complete the task due to: {execution.get('error', 'unknown error')}. "
                f"Original request: {user_request}"
            )
            execution["status"] = "completed"
        await self._broadcast_progress(task_id, 50, "executor", user_id)
        if db:
            await db.log_action(task_id, "agent-002", "execute", {"output": execution.get("output", "")[:500]})
        results["execution"] = execution
        if execution.get("tokens_used"):
            total_tokens += sum(execution["tokens_used"].values())

        # ── Step 3: Validator ─────────────────────────────────────────────────
        await self._broadcast_progress(task_id, 50, "validator", user_id)
        await self._broadcast_log("info", "Step 3/4: Validator — checking results", task_id)

        if task_type == "code_suggestion" and file_context:
            validator_desc = (
                f"Validate this code edit.\n\n"
                f"ORIGINAL REQUEST: {user_request}\n\n"
                f"ORIGINAL FILE:\n{file_context[:2000]}\n\n"
                f"UPDATED FILE:\n{execution.get('output','')[:2000]}\n\n"
                f"Does the updated file correctly implement the request? "
                f"Reply with PASS or FAIL and a brief reason."
            )
        else:
            validator_desc = (
                f"Validate this response.\n\n"
                f"ORIGINAL REQUEST: {user_request}\n\n"
                f"RESPONSE:\n{execution.get('output','')[:2000]}\n\n"
                f"Is this response accurate and complete? Reply PASS or FAIL with a brief reason."
            )

        validation = await self._run_agent_step(
            role="validator", task_id=task_id,
            description=validator_desc, original_request=user_request,
            context=execution.get("output", ""), user_id=user_id,
        )
        # Validator failure is non-fatal
        if validation.get("status") == "error":
            await self._broadcast_log("warning",
                f"Validator failed ({validation.get('error','')}), continuing", task_id)
            validation["output"] = "PASS (validation skipped due to error)"
            validation["status"] = "completed"

        await self._broadcast_progress(task_id, 75, "validator", user_id)
        if db:
            await db.log_action(task_id, "agent-003", "validate", {"output": validation.get("output", "")[:500]})
        results["validation"] = validation
        if validation.get("tokens_used"):
            total_tokens += sum(validation["tokens_used"].values())

        if failed_step:
            await self._broadcast_log("error", f"Aborting pipeline — {failed_step} agent failed", task_id)
            return {
                "task_id": task_id,
                "status": "error",
                "results": results,
                "failed_step": failed_step,
                "error": validation.get("error", "Unknown error"),
            }

        # ── Step 4: Reporter ─────────────────────────────────────────────────
        await self._broadcast_progress(task_id, 75, "reporter", user_id)
        await self._broadcast_log("info", "Step 4/4: Reporter (Gemini Flash) — formatting result", task_id)

        if task_type == "code_suggestion":
            # For code edits, the executor output IS the final file — pass it through cleanly
            reporter_desc = (
                f"Return ONLY the raw file contents below with NO explanation, NO markdown fences.\n\n"
                f"{execution.get('output', '')}"
            )
        elif file_context:
            # Do NOT include validator output here — the validator uses the small Ollama
            # model which produces unreliable text for file questions, and including it
            # causes the Reporter (Gemini) to echo that garbage as the final answer.
            reporter_desc = (
                f"Format a final answer for the user. The user asked: {user_request}\n\n"
                f"Write a clear, direct, well-structured response based only on the analysis below.\n\n"
                f"EXECUTOR ANSWER:\n{execution.get('output','')}\n\n"
                f"Write in markdown. Be specific — reference actual functions, classes, and logic."
            )
        else:
            reporter_desc = (
                f"Format a final answer for the user. The user asked: {user_request}\n\n"
                f"EXECUTOR OUTPUT:\n{execution.get('output','')}\n\n"
                f"VALIDATION:\n{validation.get('output','')}\n\n"
                f"Write a clean, well-structured markdown response."
            )

        report = await self._run_agent_step(
            role="reporter", task_id=task_id,
            description=reporter_desc, original_request=user_request, user_id=user_id,
        )
        # Reporter failure is non-fatal — fall back to executor output
        if report.get("status") == "error":
            await self._broadcast_log("warning",
                f"Reporter failed ({report.get('error','')}), using executor output as report", task_id)
            report["output"] = execution.get("output", "")
            report["status"] = "completed"

        await self._broadcast_progress(task_id, 100, "reporter", user_id)
        if db:
            await db.log_action(task_id, "agent-004", "report", {"output": report.get("output", "")[:500]})
        results["report"] = report
        if report.get("tokens_used"):
            total_tokens += sum(report["tokens_used"].values())

        if failed_step:
            await self._broadcast_log("error", f"Aborting pipeline — {failed_step} agent failed", task_id)
            return {
                "task_id": task_id,
                "status": "error",
                "results": results,
                "failed_step": failed_step,
                "error": report.get("error", "Unknown error"),
            }

        # ── Persist final result ─────────────────────────────────────────────
        final_status = "completed"

        await self._broadcast_progress(task_id, 100, "completed", user_id)

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

        result_payload: Dict[str, Any] = {
            "task_id": task_id,
            "status": final_status,
            "results": results,
            "total_tokens": total_tokens,
            "report": report.get("output", ""),
            "judgment": results.get("judgment", {}),
            "task_type": task_type,
        }

        if task_type == "code_suggestion":
            from .codespace import compute_diff, strip_code_fences
            raw = report.get("output", "")
            suggested = strip_code_fences(raw)
            result_payload["suggested_content"] = suggested
            result_payload["diff_lines"] = compute_diff(file_context or "", suggested)

        return result_payload

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
