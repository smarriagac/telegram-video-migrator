from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import os
from typing import Any

from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort

logger = logging.getLogger(__name__)


class AlertingService:
    """Dispatches operational alerts to the admin via MTProto direct message or alert channel."""

    def __init__(
        self,
        gateway: TelegramGatewayPort,
        pg_repo: Any = None,
        default_recipient: str | None = None,
        webhook_dispatcher: Any = None,
    ) -> None:
        self.gateway = gateway
        self.pg_repo = pg_repo
        self.default_recipient = default_recipient or os.getenv("ALERT_TELEGRAM_RECIPIENT", "@Smpyt")
        self.webhook_dispatcher = webhook_dispatcher

    async def get_alert_config(self, tenant_id: str = "00000000-0000-0000-0000-000000000001") -> dict[str, Any]:
        """Fetch alert configuration from database or fallback to environment defaults."""
        if self.pg_repo:
            try:
                await self.pg_repo.connect()
                if getattr(self.pg_repo, "pool", None):
                    async with self.pg_repo.pool.acquire() as conn:
                        row = await conn.fetchrow(
                            "SELECT details FROM audit_logs WHERE tenant_id = $1::uuid AND action = 'ALERT_CONFIG_UPDATE' ORDER BY created_at DESC LIMIT 1",
                            tenant_id,
                        )
                        if row and row["details"]:
                            details = json.loads(row["details"]) if isinstance(row["details"], str) else row["details"]
                            return details
            except Exception as e:
                logger.debug(f"Could not load alert config from db: {e}")

        return {
            "alert_recipient": self.default_recipient,
            "alert_channel_id": None,
            "notify_flood_wait": True,
            "notify_job_failures": True,
            "notify_vip_purchases": True,
            "notify_evictions": True,
        }

    async def send_alert(
        self,
        title: str,
        message: str,
        severity: str = "INFO",  # INFO, WARNING, ERROR, CRITICAL
        recipient: str | None = None,
        channel_id: int | None = None,
        link: str | None = None,
        event_type: str = "operational.alert",
        metadata: dict[str, Any] | None = None,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> bool:
        """Send formatted alert to recipient or alert channel, persist in-app notification, and broadcast to webhooks."""
        clean_msg = message.replace("*", "").replace("_", "").replace("`", "")

        # Broadcast to multichannel webhooks (Discord, Slack, Generic)
        if self.webhook_dispatcher:
            try:
                asyncio.create_task(
                    self.webhook_dispatcher.broadcast_event(
                        event_type=event_type,
                        title=title,
                        message=clean_msg,
                        severity=severity,
                        metadata=metadata,
                        tenant_id=tenant_id,
                    )
                )
            except Exception as e:
                logger.debug(f"Could not broadcast to webhooks: {e}")

        # Persist in-app notification for the dashboard header feed
        if self.pg_repo and hasattr(self.pg_repo, "save_notification"):
            try:
                from backend.domain.entities.app_notification import AppNotification
                in_app_notif = AppNotification.create(
                    title=title,
                    message=clean_msg,
                    severity=severity,
                    link=link,
                )
                asyncio.create_task(self.pg_repo.save_notification(in_app_notif))
            except Exception as e:
                logger.debug(f"Could not persist in-app notification: {e}")

        icon = "ℹ️" if severity == "INFO" else "⚠️" if severity == "WARNING" else "🚨"
        formatted_text = (
            f"{icon} *[TELEGRAM HUB ALERT]* {title}\n\n"
            f"{message}\n\n"
            f"⏰ _{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}_"
        )

        target_rec = recipient or self.default_recipient
        delivered = False

        if target_rec:
            try:
                delivered = await self.gateway.send_direct_message(recipient=target_rec, text=formatted_text)
            except Exception as e:
                logger.warning(f"Could not deliver alert via DM to {target_rec}: {e}")

        if channel_id:
            try:
                await self.gateway.send_text_message(channel_id=channel_id, text=formatted_text)
                delivered = True
            except Exception as e:
                logger.warning(f"Could not deliver alert to channel {channel_id}: {e}")

        return delivered

    async def notify_channel_eviction(
        self,
        source_title: str | None,
        source_channel_id: int,
        account_id: int | None = None,
        error_details: str | None = None,
    ) -> bool:
        """Alert admin that an account was banned/evicted from an auto-sync source channel."""
        try:
            cfg = await self.get_alert_config()
            if not cfg.get("notify_evictions", True):
                return False

            recipient = cfg.get("alert_recipient") or self.default_recipient
            channel_id = cfg.get("alert_channel_id")
            channel_name = source_title or f"Canal #{source_channel_id}"

            msg = (
                f"La cuenta Telegram *#{account_id or 'Principal'}* perdió acceso o fue *expulsada* del canal origen:\n"
                f"• *Canal:* `{channel_name}`\n"
                f"• *ID:* `{source_channel_id}`\n\n"
                f"⚠️ *Impacto:* La sincronización en vivo fue pausada automáticamente (`ACCESS_REVOKED`).\n"
                f"👉 *Acción sugerida:* Entrá al panel 'Live Sync Hub' y seleccioná 'Cambiar Cuenta' para relevar la sincronización con otra cuenta del pool."
            )
            if error_details:
                msg += f"\n\n_Detalle:_ `{error_details}`"

            return await self.send_alert(
                title="Acceso Revocado en Canal Origen",
                message=msg,
                severity="WARNING",
                recipient=recipient,
                channel_id=channel_id,
                link="/sync",
                event_type="channel.eviction",
                metadata={"channel_id": source_channel_id, "channel_name": channel_name, "account_id": account_id},
            )
        except Exception as e:
            logger.warning(f"Error dispatching eviction alert: {e}")
            return False

    async def notify_broadcast_failure(
        self,
        campaign_name: str | None,
        campaign_id: str,
        target_count: int,
        error_details: str | None = None,
    ) -> bool:
        """Alert admin that a scheduled/recurring broadcast campaign failed."""
        try:
            cfg = await self.get_alert_config()
            if not cfg.get("notify_job_failures", True):
                return False

            recipient = cfg.get("alert_recipient") or self.default_recipient
            channel_id = cfg.get("alert_channel_id")
            name_str = campaign_name or f"Campaña `{campaign_id[:8]}`"

            msg = (
                f"Falló la ejecución de la difusión masiva programada:\n"
                f"• *Campaña:* `{name_str}`\n"
                f"• *Destinos:* `{target_count} canales`\n"
            )
            if error_details:
                msg += f"\n🚨 *Error:* `{error_details}`\n"
            msg += "\n👉 *Acción sugerida:* Verificá los permisos del canal y las cuotas de Telegram en la consola de difusiones."

            return await self.send_alert(
                title="Fallo en Campaña de Difusión",
                message=msg,
                severity="ERROR",
                recipient=recipient,
                channel_id=channel_id,
                link="/chats",
                event_type="job.failed",
                metadata={"campaign_id": campaign_id, "campaign_name": name_str, "target_count": target_count},
            )
        except Exception as e:
            logger.warning(f"Error dispatching broadcast failure alert: {e}")
            return False

    async def notify_flood_wait(
        self,
        seconds: int,
        context: str,
        account_id: int | None = None,
    ) -> bool:
        """Alert admin that a FloodWait limit was imposed by Telegram."""
        try:
            cfg = await self.get_alert_config()
            if not cfg.get("notify_flood_wait", True):
                return False

            recipient = cfg.get("alert_recipient") or self.default_recipient
            channel_id = cfg.get("alert_channel_id")

            msg = (
                f"Telegram aplicó limitación de tasa (*FloodWait*) en la cuenta *#{account_id or 'Principal'}*:\n"
                f"• *Tiempo de espera:* `{seconds} segundos` (~{round(seconds / 60, 1)} min)\n"
                f"• *Operación:* `{context}`\n\n"
                f"ℹ️ El sistema pausará automáticamente las solicitudes durante este período para proteger la cuenta contra baneos."
            )

            return await self.send_alert(
                title="Límite FloodWait Detectado",
                message=msg,
                severity="WARNING",
                recipient=recipient,
                channel_id=channel_id,
                link="/channels",
                event_type="flood_wait",
                metadata={"seconds": seconds, "context": context, "account_id": account_id},
            )
        except Exception as e:
            logger.warning(f"Error dispatching FloodWait alert: {e}")
            return False
