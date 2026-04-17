# SpacetimeDB Integration — Real HTTP REST Client
# Calls SpacetimeDB reducer endpoints to persist data
# Gracefully degrades if SpacetimeDB is offline (logs warning, doesn't crash)

import os
import json
import uuid
import logging
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger(__name__)

DB_NAME = "agentforge"


class SpacetimeDB:
    """
    SpacetimeDB HTTP REST client.

    SpacetimeDB exposes:
      POST /database/{db}/call/{reducer}   — call a reducer
      GET  /database/{db}/query/{table}    — query a table (SQL)

    All writes are fire-and-forget with graceful failure so agent
    execution is never blocked by DB unavailability.
    """

    def __init__(self):
        host = os.getenv("SPACETIMEDB_HOST", "localhost")
        port = os.getenv("SPACETIMEDB_PORT", "8080")
        self.base_url = os.getenv("SPACETIMEDB_URL", f"http://{host}:{port}")
        self.db = DB_NAME
        self._available = True  # optimistic — set False on first failure

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def _call_reducer(self, reducer: str, args: list) -> bool:
        """Call a SpacetimeDB reducer. Returns True on success."""
        if not self._available:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self.base_url}/database/{self.db}/call/{reducer}",
                    json={"args": args},
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code in (200, 201):
                    return True
                logger.warning(
                    f"[SpacetimeDB] reducer {reducer} returned {resp.status_code}: {resp.text[:200]}"
                )
                return False
        except httpx.ConnectError:
            if self._available:
                logger.warning(
                    f"[SpacetimeDB] Cannot connect to {self.base_url} — "
                    "running without persistence (backend will still work)"
                )
                self._available = False
            return False
        except Exception as e:
            logger.warning(f"[SpacetimeDB] reducer {reducer} error: {e}")
            return False

    async def _query(self, sql: str) -> List[Dict[str, Any]]:
        """Run a SQL query against SpacetimeDB. Returns rows or []."""
        if not self._available:
            return []
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self.base_url}/database/{self.db}/sql",
                    content=sql,
                    headers={"Content-Type": "text/plain"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # SpacetimeDB returns {"rows": [...]}
                    return data.get("rows", data) if isinstance(data, dict) else data
                return []
        except Exception as e:
            logger.debug(f"[SpacetimeDB] query error: {e}")
            return []

    # ── Public API ────────────────────────────────────────────────────────────

    async def save_task(self, task: Dict[str, Any]) -> bool:
        """Persist a new task to SpacetimeDB."""
        return await self._call_reducer("create_task", [
            task["task_id"],
            task["user_request"],
            json.dumps(task.get("tool_plan", [])),
            task.get("intent_hash"),
            task.get("user_id", "anonymous"),
        ])

    async def update_task(self, task_id: str, updates: Dict[str, Any]) -> bool:
        """Update task status and progress."""
        return await self._call_reducer("update_task_status", [
            task_id,
            updates.get("status", "processing"),
            updates.get("progress", 0),
            updates.get("blocked_reason"),
        ])

    async def upsert_agent(self, agent_data: Dict[str, Any]) -> bool:
        """Create or update an agent record."""
        return await self._call_reducer("upsert_agent", [
            agent_data["id"],
            agent_data["name"],
            agent_data["role"],
            agent_data["status"],
            agent_data.get("last_task_id"),
            agent_data.get("execution_count", 0),
            json.dumps(agent_data.get("capabilities", [])),
        ])

    async def log_action(
        self,
        task_id: str,
        agent_id: str,
        action_type: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Log an agent action."""
        return await self._call_reducer("log_action", [
            str(uuid.uuid4()),
            task_id,
            agent_id,
            action_type,
            json.dumps(details) if details else None,
        ])

    async def log_security_event(
        self,
        task_id: str,
        event_type: str,
        severity: str = "warning",
        details: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Log a security/ArmorIQ event."""
        return await self._call_reducer("log_security_event", [
            str(uuid.uuid4()),
            task_id,
            event_type,
            severity,
            json.dumps(details) if details else None,
        ])

    async def set_result(
        self,
        task_id: str,
        status: str,
        output: Optional[Dict[str, Any]] = None,
        verification_status: str = "passed",
        tokens_used: int = 0,
    ) -> bool:
        """Store the final task result."""
        return await self._call_reducer("set_result", [
            str(uuid.uuid4()),
            task_id,
            status,
            json.dumps(output) if output else None,
            verification_status,
            tokens_used,
        ])

    async def get_task(self, task_id: str) -> Dict[str, Any]:
        """Retrieve a task by ID."""
        rows = await self._query(f"SELECT * FROM task WHERE id = '{task_id}'")
        return rows[0] if rows else {}

    async def get_all_tasks(self) -> List[Dict[str, Any]]:
        """Retrieve all tasks."""
        return await self._query("SELECT * FROM task ORDER BY created_at DESC")

    async def get_task_actions(self, task_id: str) -> List[Dict[str, Any]]:
        """Get all actions for a task."""
        return await self._query(
            f"SELECT * FROM action WHERE task_id = '{task_id}' ORDER BY timestamp ASC"
        )

    async def get_security_events(self, task_id: str) -> List[Dict[str, Any]]:
        """Get all security events for a task."""
        return await self._query(
            f"SELECT * FROM security_event WHERE task_id = '{task_id}' ORDER BY timestamp ASC"
        )

    async def health_check(self) -> bool:
        """Ping SpacetimeDB to check availability."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/database/{self.db}/info")
                ok = resp.status_code in (200, 404)  # 404 = DB not published yet (still live)
                if ok:
                    self._available = True
                return ok
        except Exception:
            return False


# Global singleton
db = SpacetimeDB()
