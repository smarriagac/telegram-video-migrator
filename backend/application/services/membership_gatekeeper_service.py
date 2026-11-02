from __future__ import annotations

from datetime import datetime, timezone, timedelta
import logging
from typing import Any

from backend.domain.entities.channel_membership import ChannelMembership, MembershipStatus
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort

logger = logging.getLogger(__name__)


class MembershipGatekeeperService:
    """Manages channel membership lifecycles: time-bounded invites, join tracking, and automated eviction."""

    def __init__(self, telegram_gateway: TelegramGatewayPort) -> None:
        self.gateway = telegram_gateway

    async def generate_pass(
        self,
        tenant_id: str,
        channel_id: int,
        duration_days: int = 30,
        account_id: int | None = None,
    ) -> ChannelMembership:
        """Create a single-use expiring invite link and record pending channel membership pass."""
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=duration_days)).isoformat()

        # Telethon expects unix timestamp for expire_date
        unix_expire = int((now + timedelta(days=duration_days)).timestamp())
        invite_link = await self.gateway.create_channel_invite_link(
            channel_id=channel_id,
            expire_date=unix_expire,
            member_limit=1,
            account_id=account_id,
        )

        return ChannelMembership(
            tenant_id=tenant_id,
            channel_id=channel_id,
            invite_link=invite_link,
            status=MembershipStatus.INVITED,
            expires_at=expires_at,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
        )

    async def evaluate_and_evict_expired(
        self,
        memberships: list[ChannelMembership],
        current_time: datetime | None = None,
    ) -> list[ChannelMembership]:
        """Scan active memberships and evict users whose paid time has lapsed."""
        now = current_time or datetime.now(timezone.utc)
        evicted: list[ChannelMembership] = []

        for m in memberships:
            if not m.needs_kick(now):
                continue

            assert m.telegram_user_id is not None
            logger.info(
                f"Gatekeeper: Evicting user #{m.telegram_user_id} from channel #{m.channel_id} (expired at {m.expires_at})."
            )

            success = await self.gateway.kick_chat_member(
                channel_id=m.channel_id,
                user_id=m.telegram_user_id,
            )
            if success:
                m.status = MembershipStatus.KICKED
                m.updated_at = now.isoformat()
                evicted.append(m)
            else:
                logger.warning(
                    f"Gatekeeper: Failed to kick user #{m.telegram_user_id} from channel #{m.channel_id}."
                )

        return evicted
