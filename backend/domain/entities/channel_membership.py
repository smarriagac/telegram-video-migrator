from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid


class MembershipStatus(str, Enum):
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    GRACE_PERIOD = "GRACE_PERIOD"
    EXPIRED = "EXPIRED"
    KICKED = "KICKED"
    CANCELLED = "CANCELLED"


@dataclass
class ChannelMembership:
    """Represents a time-bounded member subscription inside a protected Telegram channel or group."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = ""
    channel_id: int = 0
    telegram_user_id: int | None = None
    telegram_username: str | None = None
    invite_link: str | None = None
    status: MembershipStatus = MembershipStatus.INVITED
    joined_at: str | None = None
    expires_at: str = ""
    created_at: str | None = None
    updated_at: str | None = None

    def is_expired(self, current_time: datetime | None = None) -> bool:
        if not self.expires_at:
            return False
        try:
            exp_dt = datetime.fromisoformat(self.expires_at.replace("Z", "+00:00"))
            now_dt = current_time or datetime.now(timezone.utc)
            return now_dt > exp_dt
        except Exception:
            return False

    def needs_kick(self, current_time: datetime | None = None) -> bool:
        """Indicates if the member should be kicked by the gatekeeper worker."""
        if self.status in (MembershipStatus.KICKED, MembershipStatus.CANCELLED):
            return False
        if not self.telegram_user_id:
            # User never actually joined through the link
            return False
        return self.is_expired(current_time)
