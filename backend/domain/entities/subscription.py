from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid
from backend.domain.entities.tenant import PlanTier


class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    TRIALING = "TRIALING"
    PAST_DUE = "PAST_DUE"
    UNPAID = "UNPAID"
    CANCELED = "CANCELED"
    INCOMPLETE = "INCOMPLETE"


class PaymentProvider(str, Enum):
    STRIPE = "STRIPE"
    LEMON_SQUEEZY = "LEMON_SQUEEZY"
    CRYPTO = "CRYPTO"
    MANUAL = "MANUAL"


@dataclass
class Subscription:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = ""
    plan_tier: PlanTier = PlanTier.CREATOR
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    provider: PaymentProvider = PaymentProvider.STRIPE
    provider_customer_id: str | None = None
    provider_subscription_id: str | None = None
    current_period_start: str | None = None
    current_period_end: str | None = None
    cancel_at_period_end: bool = False
    created_at: str | None = None
    updated_at: str | None = None

    def is_in_good_standing(self) -> bool:
        """Checks if subscription allows system usage."""
        return self.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING)

    def is_expired(self, current_time: datetime | None = None) -> bool:
        if not self.current_period_end:
            return False
        try:
            end_dt = datetime.fromisoformat(self.current_period_end.replace("Z", "+00:00"))
            now_dt = current_time or datetime.now(timezone.utc)
            return now_dt > end_dt
        except Exception:
            return False
