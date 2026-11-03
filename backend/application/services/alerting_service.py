from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any

from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort

logger = logging.getLogger(__name__)


class AlertingService:
    """Dispatches operational alerts to the admin via MTProto direct message or alert channel."""

    def __init__(self, gateway: TelegramGatewayPort) -> None:
        self.gateway = gateway

    async def send_alert(
        self,
        title: str,
        message: str,
        severity: str = "INFO",  # INFO, WARNING, ERROR, CRITICAL
        recipient: str | None = None,
        channel_id: int | None = None,
    ) -> bool:
        icon = "ℹ️" if severity == "INFO" else "⚠️" if severity == "WARNING" else "🚨"
        formatted_text = (
            f"{icon} *[TELEGRAM HUB ALERT]* {title}\n\n"
            f"{message}\n\n"
            f"⏰ _{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}_"
        )

        delivered = False
        if recipient:
            try:
                delivered = await self.gateway.send_direct_message(recipient=recipient, text=formatted_text)
            except Exception as e:
                logger.warning(f"Could not deliver alert via DM to {recipient}: {e}")

        if channel_id:
            try:
                await self.gateway.send_text_message(channel_id=channel_id, text=formatted_text)
                delivered = True
            except Exception as e:
                logger.warning(f"Could not deliver alert to channel {channel_id}: {e}")

        return delivered
