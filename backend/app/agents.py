# Agent Definitions
# Multi-provider agent system: Ollama (fast) + Gemini 2.5 Flash (accurate)
# Analyzer & Validator → Ollama (fast verification)
# Executor & Reporter → Gemini Flash (accurate execution & output)

import os
from typing import Dict, Any, List, Optional
from enum import Enum
from datetime import datetime
import httpx
import json

class AgentRole(str, Enum):
    ANALYZER = "analyzer"
    EXECUTOR = "executor"
    VALIDATOR = "validator"
    REPORTER = "reporter"

class LLMProvider(str, Enum):
    OLLAMA = "ollama"
    GEMINI = "gemini"

class Agent:
    """
    Multi-provider Agent class supporting Ollama and Gemini 2.5 Flash.
    Roles are distributed: fast analysis/validation (Ollama) vs accurate execution/reporting (Gemini).
    """

    def __init__(
        self,
        id: str,
        name: str,
        role: AgentRole,
        provider: LLMProvider = LLMProvider.OLLAMA,
        model: Optional[str] = None,
        capabilities: List[str] = None,
        system_prompt: Optional[str] = None
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

        # Multi-provider configuration
        if provider == LLMProvider.OLLAMA:
            self.model = model or os.getenv("OLLAMA_MODEL", "mistral")
            self.ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434")
        elif provider == LLMProvider.GEMINI:
            self.model = model or "gemini-2.5-flash"
            self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")

    def _get_default_prompt(self) -> str:
        """Get role-specific system prompt"""
        prompts = {
            AgentRole.ANALYZER: """You are the Analyzer Agent. Your role is to:
- Carefully analyze user requests and requirements
- Break down complex problems into manageable parts
- Evaluate context and constraints
- Provide clear analysis and insights

Be thorough and structured in your analysis.""",

            AgentRole.EXECUTOR: """You are the Executor Agent. Your role is to:
- Execute approved actions from the plan
- Implement solutions based on the analysis
- Handle task execution and orchestration
- Report execution status and results

Be efficient and precise in your execution.""",

            AgentRole.VALIDATOR: """You are the Validator Agent. Your role is to:
- Validate execution results
- Perform security checks
- Verify compliance with policies
- Ensure quality standards are met

Be thorough and rigorous in validation.""",

            AgentRole.REPORTER: """You are the Reporter Agent. Your role is to:
- Format and structure results
- Generate clear reports
- Summarize findings and outcomes
- Present information professionally

Be clear and comprehensive in your reporting.""",
        }
        return prompts.get(self.role, "You are an AI agent.")

    async def process(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a task using assigned LLM provider (Ollama or Gemini).

        Args:
            task: Task data including action_id, description, original_request

        Returns:
            Result dictionary with status, output, and metadata
        """
        start_time = datetime.utcnow()
        self.status = "working"
        self.last_task_id = task.get("action_id")
        self.execution_count += 1

        try:
            # Prepare the user message
            user_message = f"""Process this task for the {self.role.value} phase:

Original Request: {task.get('original_request', 'N/A')}

Action: {task.get('description', 'N/A')}

Action ID: {task.get('action_id', 'N/A')}

Please execute this action according to your role."""

            # Route to appropriate LLM provider
            if self.provider == LLMProvider.OLLAMA:
                response_text, tokens_used = await self._call_ollama(user_message)
            elif self.provider == LLMProvider.GEMINI:
                response_text, tokens_used = await self._call_gemini(user_message)
            else:
                raise ValueError(f"Unknown LLM provider: {self.provider}")

            result = {
                "action_id": task.get("action_id"),
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_role": self.role.value,
                "status": "completed",
                "output": response_text,
                "execution_time_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000),
                "model": self.model,
                "llm_provider": self.provider.value,
                "tokens_used": tokens_used
            }

            self.status = "idle"
            return result

        except Exception as e:
            self.status = "error"
            return {
                "action_id": task.get("action_id"),
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_role": self.role.value,
                "status": "error",
                "error": f"{self.provider.value.capitalize()} API error: {str(e)}",
                "execution_time_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000)
            }

    async def _call_ollama(self, user_message: str) -> tuple:
        """
        Call Ollama API for fast local inference (analyzer, validator).

        Args:
            user_message: The user message to process

        Returns:
            Tuple of (response_text, tokens_used_dict)
        """
        payload = {
            "model": self.model,
            "prompt": f"{self.system_prompt}\n\nUser: {user_message}",
            "stream": False,
            "temperature": 0.7,
            "num_predict": 1500
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json=payload,
                )
                response.raise_for_status()

            result = response.json()
            response_text = result.get("response", "")

            # Estimate tokens
            tokens_used = {
                "input": len(user_message.split()),
                "output": len(response_text.split())
            }

            return response_text, tokens_used

        except httpx.ConnectError:
            raise Exception(f"Cannot connect to Ollama at {self.ollama_url}. Make sure Ollama is running.")
        except Exception as e:
            raise Exception(f"Ollama API error: {str(e)}")

    async def _call_gemini(self, user_message: str) -> tuple:
        """
        Call Google Gemini 2.5 Flash API for accurate execution/reporting.

        Args:
            user_message: The user message to process

        Returns:
            Tuple of (response_text, tokens_used_dict)
        """
        if not self.gemini_api_key:
            raise Exception("GEMINI_API_KEY not set in environment")

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": self.system_prompt},
                        {"text": user_message}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 1500,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                    json=payload,
                    params={"key": self.gemini_api_key}
                )
                response.raise_for_status()

            result = response.json()
            candidates = result.get("candidates", [])
            if not candidates:
                raise Exception("No response from Gemini API")

            response_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            usage = result.get("usageMetadata", {})

            tokens_used = {
                "input": usage.get("promptTokenCount", len(user_message.split())),
                "output": usage.get("candidatesTokenCount", len(response_text.split()))
            }

            return response_text, tokens_used

        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")

    def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role.value,
            "status": self.status,
            "last_task_id": self.last_task_id,
            "execution_count": self.execution_count,
            "capabilities": self.capabilities,
            "llm_provider": self.provider.value,
            "model": self.model
        }

# Multi-provider agent configuration:
# - Analyzer & Validator: Ollama (fast verification)
# - Executor & Reporter: Gemini Flash (accurate execution & output)
AGENTS = {
    "analyzer": Agent(
        id="agent-001",
        name="Analyzer",
        role=AgentRole.ANALYZER,
        provider=LLMProvider.OLLAMA,
        capabilities=["request_analysis", "context_evaluation", "requirement_breakdown"]
    ),
    "executor": Agent(
        id="agent-002",
        name="Executor",
        role=AgentRole.EXECUTOR,
        provider=LLMProvider.GEMINI,
        capabilities=["action_execution", "api_calling", "task_orchestration"]
    ),
    "validator": Agent(
        id="agent-003",
        name="Validator",
        role=AgentRole.VALIDATOR,
        provider=LLMProvider.OLLAMA,
        capabilities=["result_validation", "security_checks", "compliance_verification"]
    ),
    "reporter": Agent(
        id="agent-004",
        name="Reporter",
        role=AgentRole.REPORTER,
        provider=LLMProvider.GEMINI,
        capabilities=["result_formatting", "report_generation", "summary_creation"]
    ),
}

def get_agent(agent_id: str) -> Optional[Agent]:
    """Get an agent by ID."""
    for agent in AGENTS.values():
        if agent.id == agent_id:
            return agent
    return None

def get_agent_by_role(role: str) -> Optional[Agent]:
    """Get an agent by role"""
    return AGENTS.get(role)

def get_agents_by_role(role: AgentRole) -> List[Agent]:
    """Get all agents with a specific role."""
    return [a for a in AGENTS.values() if a.role == role]

def get_all_agent_statuses() -> Dict[str, Dict[str, Any]]:
    """Get status of all agents"""
    return {
        agent_id: agent.get_status()
        for agent_id, agent in AGENTS.items()
    }
