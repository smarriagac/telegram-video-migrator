from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import time
from typing import Any
import httpx

from backend.domain.entities.webhook_endpoint import WebhookEndpoint
from backend.domain.ports.webhook_repository_port import WebhookRepositoryPort

logger = logging.getLogger(__name__)


class WebhookDispatcherService:
    """Dispatches operational events and alerts to multichannel webhook destinations (Discord, Slack, Generic)."""

    def __init__(self, repository: WebhookRepositoryPort) -> None:
        self.repository = repository

    @staticmethod
    def get_severity_color(severity: str, format_type: str = "hex") -> int | str:
        sev = severity.upper()
        if format_type == "int":
            if sev == "INFO":
                return 0x10B981  # Emerald
            if sev == "WARNING":
                return 0xF59E0B  # Amber
            return 0xEF4444  # Rose / Red
        else:
            if sev == "INFO":
                return "#10B981"
            if sev == "WARNING":
                return "#F59E0B"
            return "#EF4444"

    def format_payload(
        self,
        endpoint: WebhookEndpoint,
        event_type: str,
        title: str,
        message: str,
        severity: str = "INFO",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Format event message according to target platform specifications."""
        meta = metadata or {}
        now_iso = datetime.now(timezone.utc).isoformat()
        sev = severity.upper()

        if endpoint.target_type == "DISCORD":
            color = self.get_severity_color(sev, format_type="int")
            fields = [
                {"name": "Evento", "value": f"`{event_type}`", "inline": True},
                {"name": "Severidad", "value": f"`{sev}`", "inline": True},
            ]
            for k, v in list(meta.items())[:6]:
                fields.append({"name": str(k).capitalize(), "value": f"`{v}`", "inline": True})

            return {
                "username": "Telegram Hub Operations",
                "avatar_url": "https://telegram.org/img/t_logo.png",
                "embeds": [
                    {
                        "title": title,
                        "description": message,
                        "color": color,
                        "fields": fields,
                        "timestamp": now_iso,
                        "footer": {"text": "Telegram Video Migrator"},
                    }
                ],
            }

        elif endpoint.target_type == "SLACK":
            color = self.get_severity_color(sev, format_type="hex")
            fields = [
                {"title": "Event", "value": event_type, "short": True},
                {"title": "Severity", "value": sev, "short": True},
            ]
            for k, v in list(meta.items())[:6]:
                fields.append({"title": str(k).capitalize(), "value": str(v), "short": True})

            return {
                "text": f"*[Telegram Hub]* {title}\n{message}",
                "attachments": [
                    {
                        "color": color,
                        "fields": fields,
                        "ts": int(time.time()),
                    }
                ],
            }

        elif endpoint.target_type == "TELEGRAM_BOT":
            # For Telegram Bot API webhook or gateway
            icon = "ℹ️" if sev == "INFO" else "⚠️" if sev == "WARNING" else "🚨"
            return {
                "text": f"{icon} *[TELEGRAM HUB]* {title}\n\n{message}\n\n_Evento:_ `{event_type}`",
                "parse_mode": "Markdown",
            }

        else:
            # GENERIC Webhook
            return {
                "event": event_type,
                "title": title,
                "message": message,
                "severity": sev,
                "timestamp": now_iso,
                "data": meta,
            }

    def generate_signature(self, payload_bytes: bytes, secret: str) -> str:
        """Generate HMAC-SHA256 signature for generic webhooks."""
        return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    async def dispatch_to_endpoint(
        self,
        endpoint: WebhookEndpoint,
        event_type: str,
        title: str,
        message: str,
        severity: str = "INFO",
        metadata: dict[str, Any] | None = None,
        max_retries: int = 3,
    ) -> tuple[bool, int | None, str | None]:
        """Send formatted payload to an endpoint with retry backoff and record results."""
        payload_dict = self.format_payload(endpoint, event_type, title, message, severity, metadata)
        payload_bytes = json.dumps(payload_dict).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "TelegramHub-WebhookDispatcher/2.0",
            "X-TelegramHub-Event": event_type,
            "X-TelegramHub-Delivery": f"deliv_{int(time.time() * 1000)}",
        }
        if endpoint.secret_token:
            sig = self.generate_signature(payload_bytes, endpoint.secret_token)
            headers["X-TelegramHub-Signature"] = f"sha256={sig}"

        last_status: int | None = None
        last_error: str | None = None
        success = False

        async with httpx.AsyncClient(timeout=8.0) as client:
            for attempt in range(1, max_retries + 1):
                try:
                    res = await client.post(endpoint.url, content=payload_bytes, headers=headers)
                    last_status = res.status_code
                    if 200 <= res.status_code < 300:
                        success = True
                        last_error = None
                        break
                    else:
                        last_error = f"HTTP {res.status_code}: {res.text[:120]}"
                        # Do not retry on 4xx client errors (e.g. 400 Bad Request, 404 Not Found)
                        if 400 <= res.status_code < 500:
                            break
                except Exception as ex:
                    last_error = f"Connection error: {str(ex)[:120]}"

                if attempt < max_retries:
                    await asyncio.sleep(0.4 * attempt)

        # Record outcome in repository
        try:
            await self.repository.record_dispatch_result(
                webhook_id=endpoint.id,
                tenant_id=endpoint.tenant_id,
                status_code=last_status,
                error=last_error,
            )
        except Exception as repo_err:
            logger.debug(f"Could not record dispatch result: {repo_err}")

        return success, last_status, last_error

    async def broadcast_event(
        self,
        event_type: str,
        title: str,
        message: str,
        severity: str = "INFO",
        metadata: dict[str, Any] | None = None,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> int:
        """Broadcast an operational event to all subscribed active webhooks for the tenant."""
        try:
            endpoints = await self.repository.list_webhooks(tenant_id=tenant_id, is_enabled=True)
            subscribed = [ep for ep in endpoints if ep.subscribes_to(event_type)]
            if not subscribed:
                return 0

            tasks = [
                self.dispatch_to_endpoint(
                    endpoint=ep,
                    event_type=event_type,
                    title=title,
                    message=message,
                    severity=severity,
                    metadata=metadata,
                )
                for ep in subscribed
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)
            delivered = sum(1 for r in results if isinstance(r, tuple) and r[0] is True)
            return delivered
        except Exception as e:
            logger.warning(f"Error in broadcast_event: {e}")
            return 0
