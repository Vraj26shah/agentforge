import os
import logging
from typing import Dict, Any, List, Optional
from enum import Enum
from datetime import datetime
import httpx
import json

logger = logging.getLogger(__name__)


class AgentRole(str, Enum):
    ANALYZER = "analyzer"
    EXECUTOR = "executor"
    VALIDATOR = "validator"
    REPORTER = "reporter"


class LLMProvider(str, Enum):
    OLLAMA = "ollama"
    GEMINI = "gemini"


class Agent:
    def __init__(
        self,
        id: str,
        name: str,
        role: AgentRole,
        provider: LLMProvider = LLMProvider.OLLAMA,
        model: Optional[str] = None,
        capabilities: List[str] = None,
        system_prompt: Optional[str] = None,
    ):
        self.id = id
        self.name = name
        self.role = role
        self.provider = provider
        self.capabilities = capabilities or []
        self.status = "idle"
        self.last_task_id: Optional[str] = None
        self.system_prompt = system_prompt or self._get_default_prompt()
        self.execution_count = 0

        self.ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434")
        # All agents load both keys so any agent can fall back to either provider
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = "gemini-2.5-flash"  # always use correct Gemini model name

        if provider == LLMProvider.OLLAMA:
            self.model = model or os.getenv("OLLAMA_MODEL", "qwen2:0.5b")
        else:
            self.model = model or self.gemini_model

    def _get_default_prompt(self) -> str:
        prompts = {
            AgentRole.ANALYZER: (
                "You are the Analyzer Agent for a software engineering platform.\n"
                "Your job: read the user request and any provided file/code context carefully,\n"
                "then output a numbered list of concrete sub-tasks the Executor must perform.\n"
                "Be specific about what lines, functions, or sections need changing.\n"
                "Always ground your analysis in the actual file content shown to you."
            ),
            AgentRole.EXECUTOR: (
                "You are the Executor Agent. You carry out the work identified by the Analyzer.\n"
                "When given file contents, you MUST modify them according to the request.\n"
                "For code tasks: output ONLY the complete updated file, no explanation, no markdown fences.\n"
                "For question/analysis tasks: give a direct, detailed answer based on the file."
            ),
            AgentRole.VALIDATOR: (
                "You are the Validator Agent. Review the Executor's output against the original request.\n"
                "Check: does the output correctly address the request? Are there bugs or omissions?\n"
                "Output a short validation summary: PASS or FAIL, with specific reasons."
            ),
            AgentRole.REPORTER: (
                "You are the Reporter Agent. Format the final result for the user in a clear, readable way.\n"
                "For code changes: show what changed and why (diff summary style).\n"
                "For questions: give a clean, well-structured answer.\n"
                "Write in plain text or markdown. Be concise and useful."
            ),
        }
        return prompts.get(self.role, "You are an AI agent. Complete the given task.")

    async def classify_intent(self, user_request: str) -> Dict[str, Any]:
        prompt = (
            f'You are a strict intent classifier for a software engineering platform.\n\n'
            f'Analyze: "{user_request}"\n\n'
            f'Valid categories: read, write, code_change, delete_file, delete_database, deploy, system_command, admin_action\n'
            f'Valid risk levels: low, medium, high, critical\n\n'
            f'Respond ONLY with valid JSON (no markdown):\n'
            f'{{"category": "...", "risk_level": "...", "description": "...", "reasoning": "..."}}'
        )
        try:
            response_text, _ = await self._call_with_fallback(prompt)
            clean = response_text.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1].lstrip("json").strip()
            parsed = json.loads(clean)
            for key in ("category", "risk_level", "description", "reasoning"):
                if key not in parsed:
                    parsed[key] = "read" if key == "category" else ("low" if key == "risk_level" else "")
            return parsed
        except Exception as e:
            logger.warning("[%s] classify_intent fallback: %s", self.name, str(e))
            req = user_request.lower()
            if any(k in req for k in ["drop", "delete database", "truncate", "wipe db"]):
                return {"category": "delete_database", "risk_level": "critical", "description": "DB deletion", "reasoning": "keyword"}
            if any(k in req for k in ["delete", "remove", "rm "]):
                return {"category": "delete_file", "risk_level": "high", "description": "File deletion", "reasoning": "keyword"}
            if any(k in req for k in ["deploy", "push to prod", "release"]):
                return {"category": "deploy", "risk_level": "high", "description": "Deployment", "reasoning": "keyword"}
            return {"category": "read", "risk_level": "low", "description": "General request", "reasoning": "default"}

    async def process(self, task: Dict[str, Any]) -> Dict[str, Any]:
        start_time = datetime.utcnow()
        self.status = "working"
        self.last_task_id = task.get("action_id")
        self.execution_count += 1

        logger.info("[%s] process() started — provider=%s", self.name, self.provider.value)
        try:
            # Use the description directly as the prompt — it already contains
            # all context (file contents, request, instructions) built by the orchestrator.
            prompt = task.get("description", "")
            if not prompt:
                prompt = f"Original request: {task.get('original_request', 'N/A')}"

            response_text, tokens_used = await self._call_with_fallback(prompt)

            elapsed = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.info("[%s] process() done in %dms, output=%d chars", self.name, elapsed, len(response_text))
            self.status = "idle"
            return {
                "action_id": task.get("action_id"),
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_role": self.role.value,
                "status": "completed",
                "output": response_text,
                "execution_time_ms": elapsed,
                "model": self.model,
                "llm_provider": self.provider.value,
                "tokens_used": tokens_used,
            }

        except Exception as e:
            elapsed = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.error("[%s] process() FAILED in %dms: %s", self.name, elapsed, str(e), exc_info=True)
            self.status = "error"
            return {
                "action_id": task.get("action_id"),
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_role": self.role.value,
                "status": "error",
                "error": str(e),
                "execution_time_ms": elapsed,
            }

    # Gemini models tried in order when 503/429 persists on the primary
    _GEMINI_MODEL_CHAIN = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]

    async def _call_with_fallback(self, prompt: str) -> tuple:
        use_ollama = os.getenv("USE_OLLAMA", "true").lower() in ("true", "1", "yes")

        if self.provider == LLMProvider.GEMINI:
            last_err: Exception = Exception("no models tried")
            for model in self._GEMINI_MODEL_CHAIN:
                try:
                    return await self._call_gemini(prompt, model=model)
                except Exception as e:
                    logger.warning("[%s] Gemini/%s failed: %s", self.name, model, str(e))
                    last_err = e

            # Skip Ollama fallback if USE_OLLAMA=false (e.g. Render deploy without Ollama)
            if not use_ollama:
                raise Exception(
                    f"All Gemini models failed and Ollama is disabled (USE_OLLAMA=false). "
                    f"Last error: {str(last_err)}"
                )

            # Truncate prompt for Ollama fallback — large prompts (>4KB) cause timeouts
            # on small models like qwen2:0.5b. Keep first 3KB to preserve instructions.
            truncated_prompt = prompt[:3000] if len(prompt) > 4000 else prompt
            if len(prompt) > 4000:
                logger.warning(
                    "[%s] All Gemini models failed (%s) — falling back to Ollama with truncated prompt (%d → %d chars)",
                    self.name, str(last_err), len(prompt), len(truncated_prompt)
                )
            else:
                logger.warning(
                    "[%s] All Gemini models failed (%s) — falling back to Ollama",
                    self.name, str(last_err)
                )
            return await self._call_ollama(truncated_prompt)
        else:
            # Ollama-primary agents: try Ollama first, fall back to Gemini
            if use_ollama:
                try:
                    return await self._call_ollama(prompt)
                except Exception as e:
                    logger.warning("[%s] Ollama failed (%s), falling back to Gemini", self.name, str(e))
                    if self.gemini_api_key:
                        return await self._call_gemini(prompt)
                    raise Exception(f"Both Ollama and Gemini unavailable. Last error: {str(e)}")
            else:
                # USE_OLLAMA=false: skip Ollama entirely, go straight to Gemini
                logger.info("[%s] USE_OLLAMA=false, using Gemini directly", self.name)
                if self.gemini_api_key:
                    return await self._call_gemini(prompt)
                raise Exception("Ollama disabled and no Gemini API key configured")

    async def _call_ollama(self, prompt: str) -> tuple:
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2:0.5b")
        logger.info("[%s] Calling Ollama model=%s", self.name, ollama_model)
        # Two attempts: first with system prompt prepended, then prompt-only.
        # Small models (qwen2:0.5b) can silently produce empty output when the
        # combined prompt exceeds their effective context window — stripping the
        # system prompt on retry fits more task content into the window.
        attempts = [f"{self.system_prompt}\n\n{prompt}", prompt]
        for attempt_no, full_prompt in enumerate(attempts, 1):
            payload = {
                "model": ollama_model,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 1024,
                    "num_ctx": 8192,
                },
            }
            try:
                async with httpx.AsyncClient(timeout=180.0) as client:
                    response = await client.post(f"{self.ollama_url}/api/generate", json=payload)
                    response.raise_for_status()
                result = response.json()
                response_text = result.get("response", "").strip()
                if response_text:
                    logger.info("[%s] Ollama OK (attempt %d) — %d chars", self.name, attempt_no, len(response_text))
                    return response_text, {"input": len(full_prompt.split()), "output": len(response_text.split())}
                logger.warning("[%s] Ollama empty on attempt %d, retrying without system prompt", self.name, attempt_no)
            except httpx.ConnectError:
                raise Exception(f"Cannot connect to Ollama at {self.ollama_url}")
            except httpx.TimeoutException:
                raise Exception(f"Ollama timed out after 180s")
            except httpx.HTTPStatusError as e:
                raise Exception(f"Ollama HTTP {e.response.status_code}: {e.response.text[:200]}")
        raise Exception("Ollama returned empty response after retry")

    async def _call_gemini(self, prompt: str, model: str = None) -> tuple:
        if not self.gemini_api_key:
            raise Exception("No Gemini API key configured")

        target_model = model or self.gemini_model
        logger.info("[%s] Calling Gemini model=%s", self.name, target_model)
        payload = {
            "contents": [{"parts": [{"text": self.system_prompt}, {"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
        }
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent",
                    json=payload,
                    params={"key": self.gemini_api_key},
                )
            logger.info("[%s] Gemini/%s HTTP %d", self.name, target_model, response.status_code)

            if response.status_code in (429, 503):
                import asyncio
                # Short per-model backoff — caller will try next model after 2 retries
                for wait in (5, 20):
                    logger.warning("[%s] Gemini/%s %d — waiting %ds before retry...",
                                   self.name, target_model, response.status_code, wait)
                    await asyncio.sleep(wait)
                    async with httpx.AsyncClient(timeout=180.0) as client:
                        response = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent",
                            json=payload,
                            params={"key": self.gemini_api_key},
                        )
                    logger.info("[%s] Gemini/%s retry HTTP %d", self.name, target_model, response.status_code)
                    if response.status_code == 200:
                        break

            if response.status_code in (401, 403):
                body = response.json().get("error", {})
                raise Exception(f"Gemini auth error {response.status_code}: {body.get('message', '')}")

            if response.status_code != 200:
                raise Exception(f"Gemini HTTP {response.status_code}: {response.text[:200]}")

            result = response.json()

            block_reason = result.get("promptFeedback", {}).get("blockReason", "")
            if block_reason:
                raise Exception(f"Gemini blocked prompt: {block_reason}")

            candidates = result.get("candidates", [])
            if not candidates:
                raise Exception(f"Gemini no candidates. Response: {str(result)[:300]}")

            candidate = candidates[0]
            finish_reason = candidate.get("finishReason", "")
            if finish_reason == "SAFETY":
                raise Exception("Gemini SAFETY block")

            # Skip thought=True parts (Gemini 2.5 thinking mode)
            parts = candidate.get("content", {}).get("parts", [])
            response_text = "".join(
                p.get("text", "") for p in parts if not p.get("thought", False)
            ).strip()

            if not response_text:
                raise Exception(f"Gemini empty text. finish={finish_reason} parts={str(parts)[:200]}")

            logger.info("[%s] Gemini OK — %d chars (finish=%s)", self.name, len(response_text), finish_reason)
            usage = result.get("usageMetadata", {})
            return response_text, {
                "input": usage.get("promptTokenCount", len(prompt.split())),
                "output": usage.get("candidatesTokenCount", len(response_text.split())),
            }

        except httpx.TimeoutException:
            raise Exception("Gemini timed out after 180s")
        except httpx.ConnectError:
            raise Exception("Cannot connect to Gemini API")
        except httpx.HTTPStatusError as e:
            raise Exception(f"Gemini HTTP error: {str(e)}")
        except Exception:
            raise  # re-raise as-is, no double-wrapping

    def get_status(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role.value,
            "status": self.status,
            "last_task_id": self.last_task_id,
            "execution_count": self.execution_count,
            "capabilities": self.capabilities,
            "llm_provider": self.provider.value,
            "model": self.model,
        }


AGENTS = {
    "analyzer": Agent(
        id="agent-001",
        name="Analyzer",
        role=AgentRole.ANALYZER,
        provider=LLMProvider.OLLAMA,
        capabilities=["request_analysis", "context_evaluation", "requirement_breakdown"],
    ),
    "executor": Agent(
        id="agent-002",
        name="Executor",
        role=AgentRole.EXECUTOR,
        provider=LLMProvider.GEMINI,
        capabilities=["code_editing", "action_execution", "task_orchestration"],
    ),
    "validator": Agent(
        id="agent-003",
        name="Validator",
        role=AgentRole.VALIDATOR,
        provider=LLMProvider.OLLAMA,
        capabilities=["result_validation", "security_checks", "compliance_verification"],
    ),
    "reporter": Agent(
        id="agent-004",
        name="Reporter",
        role=AgentRole.REPORTER,
        provider=LLMProvider.GEMINI,
        capabilities=["result_formatting", "report_generation", "summary_creation"],
    ),
}


def get_agent(agent_id: str) -> Optional[Agent]:
    for agent in AGENTS.values():
        if agent.id == agent_id:
            return agent
    return None


def get_agent_by_role(role: str) -> Optional[Agent]:
    return AGENTS.get(role)


def get_agents_by_role(role: AgentRole) -> List[Agent]:
    return [a for a in AGENTS.values() if a.role == role]


def get_all_agent_statuses() -> Dict[str, Dict[str, Any]]:
    return {agent_id: agent.get_status() for agent_id, agent in AGENTS.items()}
