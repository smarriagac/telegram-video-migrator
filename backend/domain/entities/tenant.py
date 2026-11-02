from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import uuid


class PlanTier(str, Enum):
    FREE_TRIAL = "FREE_TRIAL"
    CREATOR = "CREATOR"
    PRO_AGENCY = "PRO_AGENCY"
    ENTERPRISE = "ENTERPRISE"


class TenantStatus(str, Enum):
    ACTIVE = "ACTIVE"
    TRIALING = "TRIALING"
    PAST_DUE = "PAST_DUE"
    SUSPENDED = "SUSPENDED"
    CANCELED = "CANCELED"


TIER_DEFAULT_QUOTAS = {
    PlanTier.FREE_TRIAL: {
        "max_telegram_accounts": 1,
        "max_active_sync_bindings": 2,
        "max_monthly_bandwidth_gb": 10.0,
        "custom_caption_rules_allowed": True,
    },
    PlanTier.CREATOR: {
        "max_telegram_accounts": 2,
        "max_active_sync_bindings": 5,
        "max_monthly_bandwidth_gb": 100.0,
        "custom_caption_rules_allowed": True,
    },
    PlanTier.PRO_AGENCY: {
        "max_telegram_accounts": 10,
        "max_active_sync_bindings": 30,
        "max_monthly_bandwidth_gb": 1000.0,
        "custom_caption_rules_allowed": True,
    },
    PlanTier.ENTERPRISE: {
        "max_telegram_accounts": 50,
        "max_active_sync_bindings": 200,
        "max_monthly_bandwidth_gb": 10000.0,
        "custom_caption_rules_allowed": True,
    },
}


@dataclass
class Tenant:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    slug: str = ""
    plan_tier: PlanTier = PlanTier.FREE_TRIAL
    status: TenantStatus = TenantStatus.TRIALING
    max_telegram_accounts: int = 1
    max_active_sync_bindings: int = 2
    max_monthly_bandwidth_gb: float = 10.0
    custom_caption_rules_allowed: bool = True
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def create(
        cls,
        name: str,
        slug: str,
        plan_tier: PlanTier = PlanTier.FREE_TRIAL,
        status: TenantStatus = TenantStatus.TRIALING,
        tenant_id: str | None = None,
    ) -> Tenant:
        quotas = TIER_DEFAULT_QUOTAS.get(plan_tier, TIER_DEFAULT_QUOTAS[PlanTier.FREE_TRIAL])
        return cls(
            id=tenant_id or str(uuid.uuid4()),
            name=name,
            slug=slug.lower().strip(),
            plan_tier=plan_tier,
            status=status,
            max_telegram_accounts=quotas["max_telegram_accounts"],
            max_active_sync_bindings=quotas["max_active_sync_bindings"],
            max_monthly_bandwidth_gb=quotas["max_monthly_bandwidth_gb"],
            custom_caption_rules_allowed=quotas["custom_caption_rules_allowed"],
        )

    def is_operational(self) -> bool:
        """Determines if the tenant can execute migrations and sync processes."""
        return self.status in (TenantStatus.ACTIVE, TenantStatus.TRIALING)

    def can_add_telegram_account(self, current_accounts_count: int) -> bool:
        if not self.is_operational():
            return False
        return current_accounts_count < self.max_telegram_accounts

    def can_add_sync_binding(self, current_bindings_count: int) -> bool:
        if not self.is_operational():
            return False
        return current_bindings_count < self.max_active_sync_bindings
