from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import time
from typing import Any
import httpx

from backend.domain.entities.webhook_delivery import WebhookDelivery, WebhookDeliveryStatus
from backend.domain.ports.webhook_repository_port import WebhookRepositoryPort

logger = logging.getLogger(__name__)


class WebhookRetryEngine:
    """Asynchronous retry engine and DLQ dispatcher for failed webhook deliveries."""

    def __init__(
        self,
        repository: WebhookRepositoryPort,
        poll_interval_seconds: float = 20.0,
    ) -> None:
        self.repository = repository
        self.poll_interval_seconds = poll_interval_seconds
        self._worker_task: asyncio.Task | None = None
        self._is_running = False

    async def execute_delivery(
        self,
        delivery: WebhookDelivery,
        secret_token: str | None = None,
    ) -> tuple[bool, int | None, str | None]:
        """Dispatch a single delivery attempt to its destination URL."""
        from backend.application.services.webhook_dispatcher_service import WebhookDispatcherService

        payload_bytes = json.dumps(delivery.payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "TelegramHub-WebhookRetryEngine/2.0",
            "X-TelegramHub-Event": delivery.event_type,
            "X-TelegramHub-Delivery": delivery.id,
            "X-TelegramHub-Attempt": str(delivery.attempts + 1),
        }
        if secret_token:
            sig = WebhookDispatcherService.generate_signature(None, payload_bytes, secret_token)
            headers["X-TelegramHub-Signature"] = f"sha256={sig}"

        status_code: int | None = None
        error_msg: str | None = None
        success = False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(delivery.url, content=payload_bytes, headers=headers)
                status_code = res.status_code
                if 200 <= res.status_code < 300:
                    success = True
                else:
                    error_msg = f"HTTP {res.status_code}: {res.text[:120]}"
        except Exception as ex:
            error_msg = f"Connection error: {str(ex)[:120]}"

        # Update delivery state
        if success:
            delivery.mark_success(status_code or 200)
        else:
            delivery.mark_failure(status_code, error_msg or "Unknown delivery error")

        await self.repository.update_delivery(delivery)

        # Also update webhook endpoint last status
        try:
            await self.repository.record_dispatch_result(
                webhook_id=delivery.webhook_id,
                tenant_id=delivery.tenant_id,
                status_code=status_code,
                error=error_msg if not success else None,
            )
        except Exception as e:
            logger.debug(f"Could not update webhook endpoint status: {e}")

        return success, status_code, error_msg

    async def retry_single_delivery(
        self,
        delivery_id: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> tuple[bool, int | None, str | None]:
        """Manually force immediate retry for a delivery (e.g. from DLQ)."""
        delivery = await self.repository.get_delivery(delivery_id=delivery_id, tenant_id=tenant_id)
        if not delivery:
            return False, None, "Delivery record not found"

        endpoint = await self.repository.get_webhook(webhook_id=delivery.webhook_id, tenant_id=tenant_id)
        secret_token = endpoint.secret_token if endpoint else None
        target_url = endpoint.url if endpoint else delivery.url
        delivery.url = target_url

        return await self.execute_delivery(delivery, secret_token=secret_token)

    async def retry_all_dlq(
        self,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
        webhook_id: str | None = None,
        limit: int = 100,
    ) -> dict[str, int]:
        """1-Click batch re-dispatch of all dead-letter deliveries."""
        dlq_items, _ = await self.repository.get_dead_letter_deliveries(
            tenant_id=tenant_id,
            webhook_id=webhook_id,
            limit=limit,
            offset=0,
        )

        total = len(dlq_items)
        succeeded = 0
        failed = 0

        # Cache endpoints to avoid repetitive DB lookups
        endpoint_cache: dict[str, Any] = {}

        for item in dlq_items:
            if item.webhook_id not in endpoint_cache:
                ep = await self.repository.get_webhook(webhook_id=item.webhook_id, tenant_id=tenant_id)
                endpoint_cache[item.webhook_id] = ep
            ep = endpoint_cache[item.webhook_id]
            secret = ep.secret_token if ep else None
            if ep:
                item.url = ep.url

            ok, _, _ = await self.execute_delivery(item, secret_token=secret)
            if ok:
                succeeded += 1
            else:
                failed += 1

        return {
            "total_retried": total,
            "succeeded": succeeded,
            "failed": failed,
        }

    async def process_pending_retries(self, limit: int = 25) -> int:
        """Process one batch of pending retries whose next_retry_at is due."""
        pending_items = await self.repository.get_pending_retries(limit=limit)
        if not pending_items:
            return 0

        processed = 0
        for item in pending_items:
            try:
                ep = await self.repository.get_webhook(webhook_id=item.webhook_id, tenant_id=item.tenant_id)
                secret = ep.secret_token if ep else None
                if ep:
                    item.url = ep.url

                await self.execute_delivery(item, secret_token=secret)
                processed += 1
            except Exception as e:
                logger.warning(f"Error processing pending webhook delivery {item.id}: {e}")

        return processed

    async def start_worker(self) -> None:
        """Start background polling worker."""
        if self._is_running:
            return
        self._is_running = True
        self._worker_task = asyncio.create_task(self._run_loop())
        logger.info("WebhookRetryEngine background worker started.")

    async def stop_worker(self) -> None:
        """Stop background worker."""
        self._is_running = False
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("WebhookRetryEngine background worker stopped.")

    async def _run_loop(self) -> None:
        while self._is_running:
            try:
                await self.process_pending_retries()
            except Exception as e:
                logger.error(f"Unhandled error in WebhookRetryEngine loop: {e}")
            await asyncio.sleep(self.poll_interval_seconds)
