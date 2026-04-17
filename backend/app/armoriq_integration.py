# ArmorIQ Integration Module
# Integrates ArmorIQ SDK for intent verification, security enforcement, and policy management

import os
import json
import jwt
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
import httpx

class IntentStatus(str, Enum):
    """Status of intent verification"""
    APPROVED = "approved"
    BLOCKED = "blocked"
    PENDING = "pending"
    FAILED = "failed"

class PolicyAction(str, Enum):
    """Policy action types"""
    ALLOW = "allow"
    BLOCK = "block"
    REQUIRE_APPROVAL = "require_approval"

class UserRole(str, Enum):
    """User roles for RBAC enforcement"""
    JUNIOR_ENGINEER = "junior_engineer"
    SENIOR_DEVELOPER = "senior_developer"
    TECH_LEAD = "tech_lead"
    ADMIN = "admin"

class IntentCategory(str, Enum):
    """Classified intent categories from user requests"""
    READ = "read"
    WRITE = "write"
    CODE_CHANGE = "code_change"
    DELETE_FILE = "delete_file"
    DELETE_DATABASE = "delete_database"
    DEPLOY = "deploy"
    SYSTEM_COMMAND = "system_command"
    ADMIN_ACTION = "admin_action"

# Role-Based Access Control matrix: role → intent → PolicyAction
RBAC_MATRIX: Dict[UserRole, Dict[IntentCategory, PolicyAction]] = {
    UserRole.JUNIOR_ENGINEER: {
        IntentCategory.READ: PolicyAction.ALLOW,
        IntentCategory.WRITE: PolicyAction.ALLOW,
        IntentCategory.CODE_CHANGE: PolicyAction.ALLOW,
        IntentCategory.DELETE_FILE: PolicyAction.BLOCK,
        IntentCategory.DELETE_DATABASE: PolicyAction.BLOCK,
        IntentCategory.DEPLOY: PolicyAction.BLOCK,
        IntentCategory.SYSTEM_COMMAND: PolicyAction.BLOCK,
        IntentCategory.ADMIN_ACTION: PolicyAction.BLOCK,
    },
    UserRole.SENIOR_DEVELOPER: {
        IntentCategory.READ: PolicyAction.ALLOW,
        IntentCategory.WRITE: PolicyAction.ALLOW,
        IntentCategory.CODE_CHANGE: PolicyAction.ALLOW,
        IntentCategory.DELETE_FILE: PolicyAction.ALLOW,
        IntentCategory.DELETE_DATABASE: PolicyAction.REQUIRE_APPROVAL,
        IntentCategory.DEPLOY: PolicyAction.ALLOW,
        IntentCategory.SYSTEM_COMMAND: PolicyAction.REQUIRE_APPROVAL,
        IntentCategory.ADMIN_ACTION: PolicyAction.BLOCK,
    },
    UserRole.TECH_LEAD: {
        IntentCategory.READ: PolicyAction.ALLOW,
        IntentCategory.WRITE: PolicyAction.ALLOW,
        IntentCategory.CODE_CHANGE: PolicyAction.ALLOW,
        IntentCategory.DELETE_FILE: PolicyAction.ALLOW,
        IntentCategory.DELETE_DATABASE: PolicyAction.REQUIRE_APPROVAL,
        IntentCategory.DEPLOY: PolicyAction.ALLOW,
        IntentCategory.SYSTEM_COMMAND: PolicyAction.ALLOW,
        IntentCategory.ADMIN_ACTION: PolicyAction.REQUIRE_APPROVAL,
    },
    UserRole.ADMIN: {
        IntentCategory.READ: PolicyAction.ALLOW,
        IntentCategory.WRITE: PolicyAction.ALLOW,
        IntentCategory.CODE_CHANGE: PolicyAction.ALLOW,
        IntentCategory.DELETE_FILE: PolicyAction.ALLOW,
        IntentCategory.DELETE_DATABASE: PolicyAction.ALLOW,
        IntentCategory.DEPLOY: PolicyAction.ALLOW,
        IntentCategory.SYSTEM_COMMAND: PolicyAction.ALLOW,
        IntentCategory.ADMIN_ACTION: PolicyAction.ALLOW,
    },
}

BLOCK_REASONS: Dict[IntentCategory, Dict[UserRole, str]] = {
    IntentCategory.DELETE_FILE: {
        UserRole.JUNIOR_ENGINEER: "Junior engineers cannot delete files. Escalate to a Senior Developer.",
    },
    IntentCategory.DELETE_DATABASE: {
        UserRole.JUNIOR_ENGINEER: "Junior engineers cannot delete databases. Escalate to Admin.",
        UserRole.SENIOR_DEVELOPER: "Database deletion requires approval from Tech Lead or Admin.",
        UserRole.TECH_LEAD: "Database deletion requires approval from Admin.",
    },
    IntentCategory.DEPLOY: {
        UserRole.JUNIOR_ENGINEER: "Junior engineers cannot deploy. Escalate to Senior Developer.",
    },
    IntentCategory.SYSTEM_COMMAND: {
        UserRole.JUNIOR_ENGINEER: "Junior engineers cannot run system commands.",
        UserRole.SENIOR_DEVELOPER: "System command requires approval from Tech Lead.",
    },
    IntentCategory.ADMIN_ACTION: {
        UserRole.JUNIOR_ENGINEER: "Junior engineers cannot perform admin actions.",
        UserRole.SENIOR_DEVELOPER: "Senior developers cannot perform admin actions.",
        UserRole.TECH_LEAD: "Admin actions require approval from Admin.",
    },
}

@dataclass
class RBACJudgment:
    """Result of RBAC evaluation combining intent classification + role policy"""
    allowed: bool
    role: str
    intent_category: str
    risk_level: str
    intent_description: str
    intent_reasoning: str
    policy_action: str
    judgment_reason: str
    requires_approval_from: Optional[str] = None
    timestamp: str = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

@dataclass
class IntentToken:
    """ArmorIQ Intent Token - Cryptographically signed JWT"""
    token: str
    user_id: str
    agent_id: str
    context_id: str
    intent_hash: str
    tool_plan: List[str]
    issued_at: datetime
    expires_at: datetime
    signature: str

@dataclass
class PolicyRule:
    """Security policy rule"""
    id: str
    name: str
    description: str
    tool_name: str
    action: PolicyAction
    conditions: Dict[str, Any]
    priority: int  # Higher = more important

@dataclass
class StepVerification:
    """Result of step verification"""
    verified: bool
    step_id: str
    tool_name: str
    allowed_by_policy: bool
    reason: Optional[str] = None
    timestamp: str = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

class ArmorIQClient:
    """
    ArmorIQ SDK Client for intent verification and policy enforcement.

    Provides:
    - Intent token generation and validation
    - Tool execution approval
    - Policy enforcement
    - Audit logging
    - Fail-closed security model
    """

    def __init__(self):
        """Initialize ArmorIQ client with configuration from environment"""
        self.api_key = os.getenv("ARMORIQ_API_KEY", "")
        self.user_id = os.getenv("ARMORIQ_USER_ID", "default-user")
        self.agent_id = os.getenv("ARMORIQ_AGENT_ID", "agentforge-agent")
        self.context_id = os.getenv("ARMORIQ_CONTEXT_ID", "default")
        self.api_endpoint = os.getenv("ARMORIQ_API_ENDPOINT", "https://api.armoriq.ai/v1")
        self.validity_seconds = int(os.getenv("ARMORIQ_TOKEN_VALIDITY", "600"))

        self.http_client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=10.0
        )

        # Local policy storage (can be replaced with database)
        self.policies: Dict[str, PolicyRule] = {}
        self.intent_tokens: Dict[str, IntentToken] = {}
        self.verification_log: List[StepVerification] = []

        # Initialize default policies
        self._initialize_default_policies()

    def _initialize_default_policies(self):
        """Initialize default security policies"""
        self.policies = {
            "block_dangerous": PolicyRule(
                id="policy-003",
                name="Block Dangerous Operations",
                description="Block deletion, database drops, and system commands for any tool",
                tool_name="*",
                action=PolicyAction.BLOCK,
                conditions={
                    "keywords": ["delete all", "drop database", "rm -rf", "format disk"]
                },
                priority=100  # Highest priority — checked before any ALLOW rule
            ),
            "allow_analysis": PolicyRule(
                id="policy-001",
                name="Allow Analysis Tools",
                description="Allow analyzer agent to use analysis tools",
                tool_name="analyze",
                action=PolicyAction.ALLOW,
                conditions={},
                priority=10
            ),
            "allow_execution": PolicyRule(
                id="policy-002",
                name="Allow Execution Tools",
                description="Allow executor agent to use execution tools",
                tool_name="execute",
                action=PolicyAction.ALLOW,
                conditions={},
                priority=10
            ),
            "allow_verify": PolicyRule(
                id="policy-005",
                name="Allow Verify Tools",
                description="Allow validator agent to use verify tools",
                tool_name="verify",
                action=PolicyAction.ALLOW,
                conditions={},
                priority=10
            ),
            "allow_report": PolicyRule(
                id="policy-006",
                name="Allow Report Tools",
                description="Allow reporter agent to use report tools",
                tool_name="report",
                action=PolicyAction.ALLOW,
                conditions={},
                priority=10
            ),
        }

    async def generate_intent_token(
        self,
        user_request: str,
        tool_plan: List[str],
        additional_context: Optional[Dict[str, Any]] = None
    ) -> IntentToken:
        """
        Generate an intent token for a user request and tool plan.

        This creates a cryptographically signed JWT that proves:
        - User intent
        - Approved tool execution plan
        - Timestamp and validity period

        Args:
            user_request: Original user request
            tool_plan: List of tools to be executed
            additional_context: Additional context for intent

        Returns:
            IntentToken with signed JWT
        """
        try:
            # Create intent hash from request and plan
            intent_data = f"{user_request}:{':'.join(tool_plan)}"
            import hashlib
            intent_hash = hashlib.sha256(intent_data.encode()).hexdigest()

            # Create JWT payload
            now = datetime.utcnow()
            expires_at = now + timedelta(seconds=self.validity_seconds)

            payload = {
                "iss": "armoriq",  # Issuer
                "sub": self.user_id,  # Subject
                "agent": self.agent_id,
                "context": self.context_id,
                "intent_hash": intent_hash,
                "tool_plan": tool_plan,
                "user_request": user_request,
                "iat": int(now.timestamp()),  # Issued at
                "exp": int(expires_at.timestamp()),  # Expiration
                "additional_context": additional_context or {}
            }

            # Sign JWT with secret (in production, use proper key management)
            secret = os.getenv("ARMORIQ_SECRET_KEY", "dev-secret-key")
            token = jwt.encode(payload, secret, algorithm="HS256")

            intent_token = IntentToken(
                token=token,
                user_id=self.user_id,
                agent_id=self.agent_id,
                context_id=self.context_id,
                intent_hash=intent_hash,
                tool_plan=tool_plan,
                issued_at=now,
                expires_at=expires_at,
                signature=token[-50:]  # Last 50 chars of signature
            )

            # Store for later verification
            self.intent_tokens[intent_hash] = intent_token

            return intent_token

        except Exception as e:
            print(f"Error generating intent token: {e}")
            raise

    async def verify_intent_token(self, token: str) -> Tuple[bool, Optional[str]]:
        """
        Verify an intent token.

        Args:
            token: JWT token to verify

        Returns:
            Tuple of (is_valid, error_reason)
        """
        try:
            secret = os.getenv("ARMORIQ_SECRET_KEY", "dev-secret-key")
            payload = jwt.decode(token, secret, algorithms=["HS256"])

            # Check expiration
            exp_timestamp = payload.get("exp")
            if exp_timestamp and exp_timestamp < datetime.utcnow().timestamp():
                return False, "Token expired"

            # Verify issuer
            if payload.get("iss") != "armoriq":
                return False, "Invalid issuer"

            return True, None

        except jwt.ExpiredSignatureError:
            return False, "Token signature expired"
        except jwt.InvalidTokenError as e:
            return False, f"Invalid token: {str(e)}"
        except Exception as e:
            return False, f"Verification error: {str(e)}"

    async def verify_step(
        self,
        intent_token: str,
        step_id: str,
        tool_name: str,
        tool_params: Optional[Dict[str, Any]] = None
    ) -> StepVerification:
        """
        Verify a tool execution step against the intent token and policies.

        Fail-closed: If verification fails, execution is BLOCKED.

        Args:
            intent_token: The intent token from plan generation
            step_id: Step identifier
            tool_name: Name of tool to execute
            tool_params: Parameters for tool execution

        Returns:
            StepVerification result
        """
        # Step 1: Verify intent token
        token_valid, token_error = await self.verify_intent_token(intent_token)
        if not token_valid:
            result = StepVerification(
                verified=False,
                step_id=step_id,
                tool_name=tool_name,
                allowed_by_policy=False,
                reason=f"Invalid intent token: {token_error}"
            )
            self.verification_log.append(result)
            return result

        # Step 2: Decode token to get plan
        try:
            secret = os.getenv("ARMORIQ_SECRET_KEY", "dev-secret-key")
            payload = jwt.decode(intent_token, secret, algorithms=["HS256"])
            approved_tools = payload.get("tool_plan", [])
        except Exception as e:
            result = StepVerification(
                verified=False,
                step_id=step_id,
                tool_name=tool_name,
                allowed_by_policy=False,
                reason=f"Failed to decode intent token: {str(e)}"
            )
            self.verification_log.append(result)
            return result

        # Step 3: Check if tool is in approved plan
        if tool_name not in approved_tools:
            result = StepVerification(
                verified=False,
                step_id=step_id,
                tool_name=tool_name,
                allowed_by_policy=False,
                reason=f"Tool '{tool_name}' not in approved execution plan"
            )
            self.verification_log.append(result)
            return result

        # Step 4: Apply policies — pass user_request so keyword blocking works
        user_request = payload.get("user_request", "")
        allowed_by_policy = await self._check_policies(
            tool_name,
            tool_params or {},
            user_request=user_request,
        )

        result = StepVerification(
            verified=token_valid and allowed_by_policy,
            step_id=step_id,
            tool_name=tool_name,
            allowed_by_policy=allowed_by_policy,
            reason=None if (token_valid and allowed_by_policy) else "Policy check failed"
        )

        self.verification_log.append(result)
        return result

    async def _check_policies(
        self,
        tool_name: str,
        tool_params: Dict[str, Any],
        user_request: str = "",
    ) -> bool:
        """
        Check if tool execution is allowed by policies.

        Applies policies in priority order (higher priority = checked first).
        Fail-closed: Blocked by default unless explicitly allowed.
        """
        # Sort policies by priority (descending)
        sorted_policies = sorted(
            self.policies.values(),
            key=lambda p: p.priority,
            reverse=True
        )

        for policy in sorted_policies:
            # Check if policy applies to this tool ("*" = all tools)
            if policy.tool_name != "*" and policy.tool_name != tool_name:
                continue

            # Check conditions
            if self._check_conditions(policy.conditions, tool_params, user_request):
                if policy.action == PolicyAction.BLOCK:
                    return False
                elif policy.action == PolicyAction.ALLOW:
                    return True
                elif policy.action == PolicyAction.REQUIRE_APPROVAL:
                    # In real system, would trigger approval workflow
                    return False

        # Fail-closed: Default is to block
        return False

    def _check_conditions(
        self,
        conditions: Dict[str, Any],
        tool_params: Dict[str, Any],
        user_request: str = "",
    ) -> bool:
        """Check if policy conditions are met"""
        if not conditions:
            return True

        for condition_key, condition_value in conditions.items():
            if condition_key == "keywords":
                # Check keywords against both the user request and tool params
                search_str = (user_request + " " + str(tool_params)).lower()
                for keyword in condition_value:
                    if keyword.lower() in search_str:
                        return True
                return False  # No keyword matched — condition not met
            elif condition_key in tool_params:
                if tool_params[condition_key] != condition_value:
                    return False

        return True

    def check_rbac(
        self,
        role: str,
        intent_classification: Dict[str, Any],
    ) -> "RBACJudgment":
        """
        Evaluate RBAC policy: does this role allow this classified intent?

        Args:
            role: UserRole string (e.g. "junior_engineer")
            intent_classification: dict from Analyzer with keys:
                category, risk_level, description, reasoning

        Returns:
            RBACJudgment with allowed=True/False plus full reasoning
        """
        category_str = intent_classification.get("category", "read")
        risk_level = intent_classification.get("risk_level", "low")
        description = intent_classification.get("description", "")
        reasoning = intent_classification.get("reasoning", "")

        # Normalize role and category
        try:
            user_role = UserRole(role)
        except ValueError:
            user_role = UserRole.JUNIOR_ENGINEER

        try:
            intent_cat = IntentCategory(category_str)
        except ValueError:
            intent_cat = IntentCategory.READ

        policy_matrix = RBAC_MATRIX.get(user_role, RBAC_MATRIX[UserRole.JUNIOR_ENGINEER])
        policy_action = policy_matrix.get(intent_cat, PolicyAction.BLOCK)

        if policy_action == PolicyAction.ALLOW:
            return RBACJudgment(
                allowed=True,
                role=user_role.value,
                intent_category=intent_cat.value,
                risk_level=risk_level,
                intent_description=description,
                intent_reasoning=reasoning,
                policy_action=policy_action.value,
                judgment_reason=f"✅ ALLOWED — {user_role.value} has permission to perform '{intent_cat.value}' actions.",
            )
        elif policy_action == PolicyAction.REQUIRE_APPROVAL:
            # Determine who can approve
            approver_map = {
                (UserRole.SENIOR_DEVELOPER, IntentCategory.DELETE_DATABASE): "Tech Lead or Admin",
                (UserRole.SENIOR_DEVELOPER, IntentCategory.SYSTEM_COMMAND): "Tech Lead",
                (UserRole.TECH_LEAD, IntentCategory.DELETE_DATABASE): "Admin",
                (UserRole.TECH_LEAD, IntentCategory.ADMIN_ACTION): "Admin",
            }
            approver = approver_map.get((user_role, intent_cat), "a higher authority")
            block_msg = BLOCK_REASONS.get(intent_cat, {}).get(
                user_role,
                f"This action requires approval from {approver}."
            )
            return RBACJudgment(
                allowed=False,
                role=user_role.value,
                intent_category=intent_cat.value,
                risk_level=risk_level,
                intent_description=description,
                intent_reasoning=reasoning,
                policy_action=policy_action.value,
                judgment_reason=f"⏳ REQUIRES APPROVAL — {block_msg}",
                requires_approval_from=approver,
            )
        else:  # BLOCK
            block_msg = BLOCK_REASONS.get(intent_cat, {}).get(
                user_role,
                f"Your role '{user_role.value}' does not have permission for '{intent_cat.value}' actions."
            )
            return RBACJudgment(
                allowed=False,
                role=user_role.value,
                intent_category=intent_cat.value,
                risk_level=risk_level,
                intent_description=description,
                intent_reasoning=reasoning,
                policy_action=policy_action.value,
                judgment_reason=f"🚫 BLOCKED — {block_msg}",
            )

    def add_policy(self, policy: PolicyRule):
        """Add a new security policy"""
        self.policies[policy.id] = policy

    def remove_policy(self, policy_id: str):
        """Remove a security policy"""
        if policy_id in self.policies:
            del self.policies[policy_id]

    def get_verification_log(self) -> List[StepVerification]:
        """Get all verifications performed"""
        return self.verification_log

    def get_audit_trail(self) -> Dict[str, Any]:
        """Get complete audit trail"""
        return {
            "total_verifications": len(self.verification_log),
            "blocked_count": sum(1 for v in self.verification_log if not v.verified),
            "allowed_count": sum(1 for v in self.verification_log if v.verified),
            "policies_count": len(self.policies),
            "tokens_issued": len(self.intent_tokens),
            "verifications": [
                {
                    "step_id": v.step_id,
                    "tool_name": v.tool_name,
                    "verified": v.verified,
                    "reason": v.reason,
                    "timestamp": v.timestamp
                }
                for v in self.verification_log[-20:]  # Last 20
            ]
        }

    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()

# Global ArmorIQ client instance
armoriq_client = None

def get_armoriq_client() -> ArmorIQClient:
    """Get or create global ArmorIQ client"""
    global armoriq_client
    if armoriq_client is None:
        armoriq_client = ArmorIQClient()
    return armoriq_client

async def shutdown_armoriq():
    """Shutdown ArmorIQ client"""
    global armoriq_client
    if armoriq_client:
        await armoriq_client.close()
        armoriq_client = None
