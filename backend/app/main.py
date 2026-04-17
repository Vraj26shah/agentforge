import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    force=True,
)

from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
from dotenv import load_dotenv
import uuid
from datetime import datetime
import json

# Import project modules
from . import codespace as cs
from .armoriq_integration import (
    get_armoriq_client, shutdown_armoriq, IntentStatus, PolicyAction,
    UserRole, IntentCategory, RBAC_MATRIX
)
from .orchestrator import orchestrator
from .agents import AGENTS, get_all_agent_statuses
from .spacetime import db  # SpacetimeDB HTTP client

load_dotenv()

app = FastAPI(
    title="AgentForge Backend",
    description="Multi-agent AI orchestration system with ArmorIQ + SpacetimeDB",
    version="0.1.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory task cache (SpacetimeDB is the persistent store)
tasks_db: Dict[str, Dict[str, Any]] = {}
active_websockets: Dict[WebSocket, str] = {}  # ws → session_id

# ── Request/Response Models ────────────────────────────────────────────────────

class UserRequest(BaseModel):
    user_request: str
    context: Optional[dict] = None
    user_id: Optional[str] = "anonymous"
    role: Optional[str] = "junior_engineer"  # UserRole: junior_engineer | senior_developer | tech_lead | admin

class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None
    plan_id: Optional[str] = None
    blocked_reason: Optional[str] = None
    judgment: Optional[Dict[str, Any]] = None

class TaskDetails(BaseModel):
    task_id: str
    status: str
    user_request: str
    plan_id: Optional[str]
    plan_status: Optional[str]
    security_level: Optional[str]
    blocked_reason: Optional[str]
    actions: Optional[list]
    created_at: str
    updated_at: str

# ── WebSocket broadcast ────────────────────────────────────────────────────────

async def broadcast_update(message: Dict[str, Any]):
    """Broadcast a message to all connected WebSocket clients."""
    message["timestamp"] = datetime.utcnow().isoformat()
    disconnected = set()

    for websocket in list(active_websockets.keys()):
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"Error broadcasting to client: {e}")
            disconnected.add(websocket)

    for ws in disconnected:
        active_websockets.pop(ws, None)


async def _broadcast_users_count():
    """Broadcast the current count of connected users."""
    await broadcast_update({
        "type": "users_update",
        "connected_users": len(active_websockets),
    })

# ── Root + Health check ────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "AgentForge Backend",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }

@app.get("/health")
async def health():
    spacetimedb_ok = await db.health_check()
    return {
        "status": "ok",
        "service": "agentforge-backend",
        "version": "0.1.0",
        "armoriq": "enabled",
        "spacetimedb": "connected" if spacetimedb_ok else "offline (graceful degradation)",
        "timestamp": datetime.utcnow().isoformat()
    }

# ── Submit request through ArmorIQ ────────────────────────────────────────────

@app.post("/api/jailbreak")
async def submit_jailbreak(
    request: UserRequest,
    background_tasks: BackgroundTasks
):
    """
    Submit a request for processing through ArmorIQ intent verification.

    Pipeline:
    1. Parse tool plan from request
    2. Generate & verify ArmorIQ intent token
    3. Persist task to SpacetimeDB
    4. Queue for 4-agent orchestration (Analyzer → Executor → Validator → Reporter)
    """
    try:
        task_id = f"task-{uuid.uuid4().hex[:8]}"
        armoriq = get_armoriq_client()

        # Step 1: Identify tools needed
        tool_plan = identify_tools_from_request(request.user_request)

        # Step 2: Generate intent token
        intent_token = await armoriq.generate_intent_token(
            user_request=request.user_request,
            tool_plan=tool_plan,
            additional_context=request.context
        )

        # Step 3: Verify intent token
        is_valid, token_error = await armoriq.verify_intent_token(intent_token.token)

        # Build task record
        task = {
            "task_id": task_id,
            "user_request": request.user_request,
            "user_id": request.user_id or "anonymous",
            "role": request.role or "junior_engineer",
            "intent_token": intent_token.token,
            "intent_hash": intent_token.intent_hash,
            "tool_plan": tool_plan,
            "status": "created",
            "token_valid": is_valid,
            "token_error": token_error,
            "created_at": intent_token.issued_at.isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "context": request.context or {}
        }
        tasks_db[task_id] = task

        # Step 4: Persist to SpacetimeDB
        await db.save_task(task)

        # Step 5: Determine status and queue
        if not is_valid:
            task["status"] = "blocked"
            response_status = "blocked"
            reason = token_error
            # Log security event for the invalid token
            await db.log_security_event(
                task_id=task_id,
                event_type="verification_failed",
                severity="blocked",
                details={"reason": token_error}
            )
        else:
            task["status"] = "queued"
            response_status = "queued"
            reason = None
            # Update SpacetimeDB with queued status
            await db.update_task(task_id, {"status": "queued", "progress": 0})
            # Queue the full orchestration pipeline in background
            background_tasks.add_task(
                process_task_with_armoriq,
                task_id,
                intent_token.token,
                tool_plan,
                request.user_id or "anonymous",
                request.role or "junior_engineer",
            )

        # Broadcast to WebSocket clients
        await broadcast_update({
            "type": "task_update",
            "task": {
                "id": task_id,
                "user_request": request.user_request,
                "status": response_status,
                "plan_id": intent_token.intent_hash,
                "blocked_reason": reason,
                "created_at": intent_token.issued_at.isoformat(),
                "progress": 0,
                "user_id": request.user_id or "anonymous"
            }
        })
        await broadcast_update({
            "type": "log",
            "level": "info",
            "message": f"Task {task_id} submitted — ArmorIQ intent token generated",
            "task_id": task_id
        })

        return TaskResponse(
            task_id=task_id,
            status=response_status,
            plan_id=intent_token.intent_hash,
            blocked_reason=reason,
            message=(
                f"Request submitted — role='{request.role or 'junior_engineer'}'. "
                f"Intent will be classified and RBAC enforced before execution."
                if response_status != "blocked"
                else "Request blocked by ArmorIQ token verification."
            ),
        )

    except Exception as e:
        print(f"Error in submit_jailbreak: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# ── Tool identification helper ─────────────────────────────────────────────────

def is_question_request(user_request: str) -> bool:
    """Return True if the user is asking a question/explanation rather than requesting a code change."""
    text = user_request.lower().strip()
    change_words = [
        "add ", "create ", "implement ", "write ", "fix ", "update ",
        "change ", "modify ", "refactor ", "replace ", "delete ", "remove ",
        "rename ", "move ", "convert ", "rewrite ", "insert ", "edit ",
        "optimize ", "generate ", "append ", "make ", "set ",
    ]
    if any(text.startswith(w) for w in change_words):
        return False
    question_words = [
        "what", "why", "how", "explain", "describe", "tell me",
        "analyze", "analyse", "summarize", "summarise", "review",
        "find ", "where", "when ", "who ", "which ", "list ",
        "show me", "help me understand", "understand", "is there",
        "does ", "do ", "can you tell", "can you explain",
    ]
    return "?" in user_request or any(text.startswith(w) for w in question_words)


def identify_tools_from_request(user_request: str) -> List[str]:
    """Identify required tools/actions from user request."""
    request_lower = user_request.lower()
    tools = []

    if any(word in request_lower for word in ["analyze", "evaluation", "insight", "understand"]):
        tools.append("analyze")
    if any(word in request_lower for word in ["execute", "run", "perform", "do", "process"]):
        tools.append("execute")
    if any(word in request_lower for word in ["check", "verify", "validate", "confirm"]):
        tools.append("verify")
    if any(word in request_lower for word in ["report", "summarize", "format", "generate", "summary"]):
        tools.append("report")

    if not tools:
        tools = ["analyze"]

    return tools

# ── Background task processor ─────────────────────────────────────────────────

async def process_task_with_armoriq(
    task_id: str,
    intent_token: str,
    tool_plan: List[str],
    user_id: str = "anonymous",
    role: str = "junior_engineer",
):
    """
    Execute the full 4-agent pipeline with ArmorIQ verification.

    Flow:
    1. Verify each tool step with ArmorIQ (fail-closed)
    2. Run orchestrator 4-agent pipeline (Analyzer → Executor → Validator → Reporter)
    3. Persist updates to SpacetimeDB at each stage
    4. Broadcast agent_update + task_update events via WebSocket
    """
    task = tasks_db.get(task_id)
    if not task:
        return

    armoriq = get_armoriq_client()

    try:
        # Mark processing
        task["status"] = "processing"
        task["updated_at"] = datetime.utcnow().isoformat()
        await db.update_task(task_id, {"status": "processing", "progress": 5})
        await broadcast_update({
            "type": "task_update",
            "task": {"id": task_id, "status": "processing", "progress": 5, "user_id": user_id}
        })
        await broadcast_update({
            "type": "log",
            "level": "info",
            "message": f"Task {task_id} — ArmorIQ pre-flight verification for {len(tool_plan)} tool(s)",
            "task_id": task_id
        })

        # ── ArmorIQ pre-flight: verify all tools before any execution ──────
        for step_index, tool_name in enumerate(tool_plan):
            step_id = f"step-{step_index + 1}"
            verification = await armoriq.verify_step(
                intent_token=intent_token,
                step_id=step_id,
                tool_name=tool_name
            )

            await broadcast_update({
                "type": "log",
                "level": "success" if verification.verified else "error",
                "message": f"ArmorIQ {'' if verification.verified else 'BLOCKED '}verified step {step_id} — tool={tool_name}",
                "task_id": task_id
            })

            if not verification.verified:
                reason_msg = verification.reason or "Policy check failed"
                task["status"] = "blocked"
                task["blocked_reason"] = reason_msg
                task["updated_at"] = datetime.utcnow().isoformat()

                await db.update_task(task_id, {"status": "blocked", "progress": 0,
                                               "blocked_reason": reason_msg})
                await db.log_security_event(
                    task_id=task_id,
                    event_type="policy_violation",
                    severity="blocked",
                    details={"tool": tool_name, "step": step_id, "reason": reason_msg}
                )
                await broadcast_update({
                    "type": "task_update",
                    "task": {"id": task_id, "status": "blocked",
                             "blocked_reason": reason_msg, "progress": 0, "user_id": user_id}
                })
                await broadcast_update({
                    "type": "security_event",
                    "severity": "blocked",
                    "message": f"ArmorIQ BLOCKED: {tool_name} — {reason_msg}",
                    "task_id": task_id
                })
                return

        # ── All tools verified — run 4-agent orchestration pipeline ────────
        await broadcast_update({
            "type": "log",
            "level": "info",
            "message": f"Task {task_id} — all tools verified, starting 4-agent pipeline",
            "task_id": task_id
        })
        await db.update_task(task_id, {"status": "processing", "progress": 15})

        # Broadcast initial idle→working state for Analyzer agent
        await broadcast_update({
            "type": "agent_update",
            "agent": {
                "id": "agent-001",
                "name": "Analyzer",
                "role": "analyzer",
                "status": "working",
                "last_task_id": task_id,
                "execution_count": AGENTS["analyzer"].execution_count,
                "capabilities": AGENTS["analyzer"].capabilities,
                "llm_provider": "ollama"
            }
        })

        orchestration_result = await orchestrator.orchestrate(
            task_id=task_id,
            user_request=task["user_request"],
            tool_plan=tool_plan,
            db=db,
            user_id=user_id,
            role=role,
        )

        # ── Update task with final result ────────────────────────────────────
        final_status = orchestration_result.get("status", "completed")
        task["status"] = final_status
        task["orchestration_result"] = orchestration_result
        task["updated_at"] = datetime.utcnow().isoformat()
        task["progress"] = 100 if final_status == "completed" else 50
        task["report"] = orchestration_result.get("report", "")
        task["judgment"] = orchestration_result.get("judgment", {})

        # Handle error status with failed_step information
        blocked_reason = None
        if final_status == "error":
            failed_step = orchestration_result.get("failed_step", "unknown")
            error_msg = orchestration_result.get("error", "Unknown error")
            blocked_reason = f"{failed_step}: {error_msg}"
            task["blocked_reason"] = blocked_reason

        await db.update_task(task_id, {
            "status": final_status,
            "progress": task["progress"],
            "blocked_reason": blocked_reason,
        })

        await broadcast_update({
            "type": "task_update",
            "task": {
                "id": task_id,
                "status": final_status,
                "progress": 100 if final_status == "completed" else 50,
                "report": orchestration_result.get("report", ""),
                "blocked_reason": blocked_reason,
                "user_id": user_id,
                "judgment": orchestration_result.get("judgment", {}),
            }
        })
        await broadcast_update({
            "type": "log",
            "level": "success" if final_status == "completed" else "warning",
            "message": (
                f"Task {task_id} {final_status} — "
                f"tokens used: {orchestration_result.get('total_tokens', 0)}"
            ),
            "task_id": task_id
        })

        # Broadcast all agents back to idle
        for role_key, agent in AGENTS.items():
            await broadcast_update({
                "type": "agent_update",
                "agent": agent.get_status()
            })

    except Exception as e:
        print(f"Error processing task {task_id}: {e}")
        task["status"] = "error"
        task["error"] = str(e)
        task["updated_at"] = datetime.utcnow().isoformat()

        error_msg = str(e)
        blocked_reason = f"system: {error_msg}"
        task["blocked_reason"] = blocked_reason

        await db.update_task(task_id, {"status": "error", "progress": 0, "blocked_reason": blocked_reason})
        await broadcast_update({
            "type": "task_update",
            "task": {"id": task_id, "status": "error", "progress": 0, "blocked_reason": blocked_reason, "user_id": user_id}
        })
        await broadcast_update({
            "type": "log",
            "level": "error",
            "message": f"Task {task_id} failed: {error_msg}",
            "task_id": task_id
        })

# ── Task endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    details = TaskDetails(
        task_id=task["task_id"],
        status=task["status"],
        user_request=task["user_request"],
        plan_id=task.get("intent_hash"),
        plan_status=task.get("security_level"),
        security_level=task.get("security_level"),
        blocked_reason=task.get("blocked_reason"),
        actions=task.get("actions"),
        created_at=task["created_at"],
        updated_at=task["updated_at"]
    )
    response = details.dict()
    response["user_id"] = task.get("user_id", "anonymous")
    response["task_type"] = task.get("task_type", "general")
    response["progress"] = task.get("progress", 0)
    response["report"] = task.get("report", "")
    response["suggested_content"] = task.get("suggested_content", "")
    response["diff_lines"] = task.get("diff_lines", [])
    response["judgment"] = task.get("judgment", {})
    response["file_path"] = task.get("file_path")
    return response

@app.get("/api/plans")
async def list_plans():
    return {
        "plans": [
            {
                "id": t["task_id"],
                "user_request": t["user_request"],
                "status": t["status"],
                "tool_plan": t.get("tool_plan", []),
                "intent_hash": t.get("intent_hash", ""),
                "created_at": t["created_at"]
            }
            for t in tasks_db.values()
        ],
        "total": len(tasks_db)
    }

@app.get("/api/history")
async def get_history():
    armoriq = get_armoriq_client()
    return {
        "history": armoriq.get_audit_trail().get("verifications", []),
        "total_executions": armoriq.get_audit_trail().get("total_verifications", 0)
    }

@app.get("/api/agents")
async def get_agents_status():
    return {
        "agents": get_all_agent_statuses(),
        "total_agents": len(AGENTS),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/plans/{plan_id}")
async def get_plan_details(plan_id: str):
    task = tasks_db.get(plan_id)
    if not task:
        task = next((t for t in tasks_db.values() if t.get("intent_hash") == plan_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Plan not found")

    return {
        "plan_id": task.get("intent_hash", task["task_id"]),
        "task_id": task["task_id"],
        "user_request": task["user_request"],
        "status": task["status"],
        "tool_plan": task.get("tool_plan", []),
        "verification_results": task.get("verification_results", []),
        "created_at": task["created_at"],
        "updated_at": task["updated_at"]
    }

# ── ArmorIQ endpoints ──────────────────────────────────────────────────────────

@app.get("/api/roles")
async def get_roles():
    """Return available roles and their permission matrix."""
    matrix = {}
    for role, perms in RBAC_MATRIX.items():
        matrix[role.value] = {intent.value: action.value for intent, action in perms.items()}
    return {
        "roles": [r.value for r in UserRole],
        "intent_categories": [c.value for c in IntentCategory],
        "permission_matrix": matrix,
    }

@app.get("/api/armoriq/stats")
async def get_armoriq_stats():
    armoriq = get_armoriq_client()
    trail = armoriq.get_audit_trail()
    return {
        "total_tasks": len(tasks_db),
        "total_verifications": trail["total_verifications"],
        "blocked_count": trail["blocked_count"],
        "allowed_count": trail["allowed_count"],
        "policies_count": trail["policies_count"],
        "tokens_issued": trail["tokens_issued"],
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/armorq/stats")
async def get_armorq_stats_legacy():
    return await get_armoriq_stats()

@app.post("/api/armoriq/generate-token")
async def generate_intent_token(request: UserRequest):
    try:
        armoriq = get_armoriq_client()
        tool_plan = identify_tools_from_request(request.user_request)
        intent_token = await armoriq.generate_intent_token(
            user_request=request.user_request,
            tool_plan=tool_plan,
            additional_context=request.context
        )
        return {
            "intent_hash": intent_token.intent_hash,
            "token": intent_token.token,
            "user_id": intent_token.user_id,
            "agent_id": intent_token.agent_id,
            "tool_plan": intent_token.tool_plan,
            "issued_at": intent_token.issued_at.isoformat(),
            "expires_at": intent_token.expires_at.isoformat(),
            "validity_seconds": (intent_token.expires_at - intent_token.issued_at).total_seconds()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token generation error: {str(e)}")

@app.post("/api/armoriq/verify-token")
async def verify_intent_token(request: Dict[str, str]):
    try:
        token = request.get("token")
        if not token:
            raise HTTPException(status_code=400, detail="Token required")
        armoriq = get_armoriq_client()
        is_valid, error = await armoriq.verify_intent_token(token)
        return {
            "valid": is_valid,
            "error": error,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token verification error: {str(e)}")

class FileWriteRequest(BaseModel):
    path: str
    content: str

class CodeSuggestRequest(BaseModel):
    file_path: str
    request: str
    user_id: Optional[str] = "anonymous"
    role: Optional[str] = "junior_engineer"
    chat_history: Optional[List[Dict[str, str]]] = []

# ── Codespace endpoints ────────────────────────────────────────────────────────

@app.get("/api/codespace/tree")
async def codespace_tree(sub: str = ""):
    return {"tree": cs.get_file_tree(sub)}

@app.get("/api/codespace/file")
async def codespace_read(path: str):
    result = cs.read_file(path)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/codespace/apply")
async def codespace_apply(req: FileWriteRequest):
    result = cs.write_file(req.path, req.content)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/codespace/suggest")
async def codespace_suggest(req: CodeSuggestRequest, background_tasks: BackgroundTasks):
    file_result = cs.read_file(req.file_path)
    if "error" in file_result:
        raise HTTPException(status_code=400, detail=file_result["error"])

    task_id = f"cs-{uuid.uuid4().hex[:8]}"
    armoriq = get_armoriq_client()
    tool_plan = ["analyze", "execute", "verify", "report"]
    intent_token = await armoriq.generate_intent_token(
        user_request=req.request,
        tool_plan=tool_plan,
        additional_context={"file_path": req.file_path}
    )

    # Detect whether this is a question/explanation or a code-change request
    task_type = "file_question" if is_question_request(req.request) else "code_suggestion"

    task = {
        "task_id": task_id,
        "user_request": req.request,
        "user_id": req.user_id or "anonymous",
        "role": req.role or "junior_engineer",
        "intent_token": intent_token.token,
        "intent_hash": intent_token.intent_hash,
        "tool_plan": tool_plan,
        "status": "queued",
        "token_valid": True,
        "created_at": intent_token.issued_at.isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "context": {"file_path": req.file_path, "task_type": task_type},
        "file_path": req.file_path,
        "task_type": task_type,
    }
    tasks_db[task_id] = task

    await broadcast_update({
        "type": "task_update",
        "task": {
            "id": task_id,
            "user_request": req.request,
            "status": "queued",
            "plan_id": intent_token.intent_hash,
            "created_at": intent_token.issued_at.isoformat(),
            "progress": 0,
            "user_id": req.user_id or "anonymous",
            "task_type": task_type,
            "file_path": req.file_path,
        }
    })

    background_tasks.add_task(
        process_code_suggestion_task,
        task_id,
        intent_token.token,
        tool_plan,
        req.user_id or "anonymous",
        req.role or "junior_engineer",
        req.file_path,
        file_result["content"],
        task_type,
        req.chat_history or [],
    )
    return {"task_id": task_id, "status": "queued"}


async def process_code_suggestion_task(
    task_id: str,
    intent_token: str,
    tool_plan: List[str],
    user_id: str,
    role: str,
    file_path: str,
    file_content: str,
    task_type: str = "code_suggestion",
    chat_history: Optional[List[Dict[str, str]]] = None,
):
    task = tasks_db.get(task_id)
    if not task:
        return

    armoriq = get_armoriq_client()
    try:
        task["status"] = "processing"
        await broadcast_update({
            "type": "task_update",
            "task": {"id": task_id, "status": "processing", "progress": 5,
                     "user_id": user_id, "task_type": task_type, "file_path": file_path}
        })

        # ArmorIQ pre-flight
        for i, tool_name in enumerate(tool_plan):
            verification = await armoriq.verify_step(
                intent_token=intent_token, step_id=f"step-{i+1}", tool_name=tool_name
            )
            if not verification.verified:
                reason_msg = verification.reason or "Policy check failed"
                task["status"] = "blocked"
                task["blocked_reason"] = reason_msg
                await broadcast_update({
                    "type": "task_update",
                    "task": {"id": task_id, "status": "blocked",
                             "blocked_reason": reason_msg, "progress": 0,
                             "user_id": user_id, "task_type": task_type}
                })
                return

        orchestration_result = await orchestrator.orchestrate(
            task_id=task_id,
            user_request=task["user_request"],
            tool_plan=tool_plan,
            db=db,
            user_id=user_id,
            role=role,
            task_type=task_type,
            file_context=file_content,
            chat_history=chat_history or [],
        )

        final_status = orchestration_result.get("status", "completed")
        task["status"] = final_status
        task["updated_at"] = datetime.utcnow().isoformat()
        task["progress"] = 100 if final_status == "completed" else 50
        task["report"] = orchestration_result.get("report", "")
        task["judgment"] = orchestration_result.get("judgment", {})
        if task_type == "code_suggestion":
            task["suggested_content"] = orchestration_result.get("suggested_content", "")
            task["diff_lines"] = orchestration_result.get("diff_lines", [])

        update_payload: Dict[str, Any] = {
            "id": task_id,
            "status": final_status,
            "progress": task["progress"],
            "report": orchestration_result.get("report", ""),
            "user_id": user_id,
            "judgment": orchestration_result.get("judgment", {}),
            "task_type": task_type,
            "file_path": file_path,
        }
        if task_type == "code_suggestion":
            update_payload["suggested_content"] = orchestration_result.get("suggested_content", "")
            update_payload["diff_lines"] = orchestration_result.get("diff_lines", [])

        await broadcast_update({"type": "task_update", "task": update_payload})
    except Exception as e:
        task["status"] = "error"
        await broadcast_update({
            "type": "task_update",
            "task": {"id": task_id, "status": "error", "progress": 0,
                     "blocked_reason": str(e), "user_id": user_id, "task_type": task_type}
        })


class VerifyStepRequest(BaseModel):
    intent_token: str
    step_id: str
    tool_name: str
    tool_params: Optional[Dict[str, Any]] = None

@app.post("/api/armoriq/verify-step")
async def verify_step(request: VerifyStepRequest):
    try:
        armoriq = get_armoriq_client()
        verification = await armoriq.verify_step(
            intent_token=request.intent_token,
            step_id=request.step_id,
            tool_name=request.tool_name,
            tool_params=request.tool_params
        )
        return {
            "verified": verification.verified,
            "step_id": verification.step_id,
            "tool_name": verification.tool_name,
            "allowed_by_policy": verification.allowed_by_policy,
            "reason": verification.reason,
            "timestamp": verification.timestamp
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Step verification error: {str(e)}")

@app.get("/api/armoriq/audit-trail")
async def get_audit_trail():
    try:
        armoriq = get_armoriq_client()
        return armoriq.get_audit_trail()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit trail error: {str(e)}")

@app.get("/api/armoriq/policies")
async def get_policies():
    try:
        armoriq = get_armoriq_client()
        return {
            "policies": [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "tool_name": p.tool_name,
                    "action": p.action.value,
                    "priority": p.priority
                }
                for p in armoriq.policies.values()
            ],
            "total": len(armoriq.policies)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Policies error: {str(e)}")

# ── WebSocket ──────────────────────────────────────────────────────────────────

@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket, session_id: str = "anonymous"):
    """WebSocket for real-time task/agent updates. Supports multi-user collaboration."""
    await websocket.accept()
    active_websockets[websocket] = session_id

    try:
        # Send initial state: agent statuses
        await websocket.send_json({
            "type": "connected",
            "timestamp": datetime.utcnow().isoformat(),
            "agents": list(get_all_agent_statuses().values()),
        })

        # Send all existing tasks (in-memory first, fallback to SpacetimeDB)
        existing_tasks = list(tasks_db.values())
        if not existing_tasks:
            # Only hit SpacetimeDB if memory is empty (e.g., after restart)
            spacetime_tasks = await db.get_all_tasks()
            # Normalize SpacetimeDB rows to match tasks_db shape
            existing_tasks = [
                {
                    "task_id": t.get("id", t.get("task_id", "")),
                    "user_request": t.get("user_request", ""),
                    "status": t.get("status", "queued"),
                    "progress": t.get("progress", 0),
                    "user_id": t.get("user_id", "anonymous"),
                    "created_at": t.get("created_at", datetime.utcnow().isoformat()),
                    "intent_hash": t.get("intent_hash", ""),
                    "blocked_reason": t.get("blocked_reason"),
                }
                for t in spacetime_tasks
            ]

        await websocket.send_json({
            "type": "existing_tasks",
            "tasks": [
                {
                    "id": t.get("task_id", t.get("id", "")),
                    "user_request": t.get("user_request", ""),
                    "status": t.get("status", "queued"),
                    "progress": t.get("progress", 0),
                    "user_id": t.get("user_id", "anonymous"),
                    "created_at": t.get("created_at", datetime.utcnow().isoformat()),
                    "plan_id": t.get("intent_hash"),
                    "blocked_reason": t.get("blocked_reason"),
                    # Codespace fields — needed so handleTaskResult fires correctly on reconnect
                    "task_type": t.get("task_type"),
                    "file_path": t.get("file_path"),
                    "report": t.get("report"),
                    "suggested_content": t.get("suggested_content"),
                    "diff_lines": t.get("diff_lines"),
                    "judgment": t.get("judgment"),
                }
                for t in existing_tasks
            ],
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Broadcast live user count to all clients
        await _broadcast_users_count()

        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "pong", "data": data})
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        active_websockets.pop(websocket, None)
        # Broadcast updated user count after disconnect
        await _broadcast_users_count()

# ── Lifecycle events ───────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    print("Starting AgentForge backend with ArmorIQ + SpacetimeDB...")

    # Wire broadcast function into orchestrator so it can emit WebSocket events
    orchestrator.set_broadcast(broadcast_update)

    armoriq = get_armoriq_client()
    print(f"ArmorIQ initialized")
    print(f"  Agent ID:       {armoriq.agent_id}")
    print(f"  User ID:        {armoriq.user_id}")
    print(f"  Token validity: {armoriq.validity_seconds}s")
    print(f"  Policies:       {len(armoriq.policies)}")

    spacetimedb_ok = await db.health_check()
    print(f"SpacetimeDB:    {'connected @ ' + db.base_url if spacetimedb_ok else 'OFFLINE — running without persistence'}")

@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down AgentForge backend...")
    await shutdown_armoriq()
    print("ArmorIQ shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
