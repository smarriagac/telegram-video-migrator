from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from typing import Any

from backend.domain.entities.scheduled_broadcast import ScheduledBroadcast
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.domain.entities.audit_log import AuditLog
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.application.broadcaster import EventBroadcaster

logger = logging.getLogger(__name__)


class BroadcastSchedulerService:
    """Background service that periodically polls and executes scheduled/recurring message broadcasts."""

    def __init__(
        self,
        job_repo: JobRepositoryPort,
        telegram_gateway: TelegramGatewayPort,
        broadcaster: EventBroadcaster | None = None,
        audit_repo: AuditRepositoryPort | None = None,
        alerting_service: Any | None = None,
        poll_interval: float = 10.0,
    ) -> None:
        self.job_repo = job_repo
        self.gateway = telegram_gateway
        self.broadcaster = broadcaster
        self.audit_repo = audit_repo
        self.alerting_service = alerting_service
        self.poll_interval = poll_interval
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("BroadcastSchedulerService background polling loop started.")

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("BroadcastSchedulerService background polling loop stopped.")

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                await self.check_and_trigger_scheduled_broadcasts()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Error in BroadcastSchedulerService loop: {e}")
            await asyncio.sleep(self.poll_interval)

    async def check_and_trigger_scheduled_broadcasts(self) -> list[str]:
        now_dt = datetime.now(timezone.utc)
        triggered_ids: list[str] = []

        try:
            scheduled_items = await self.job_repo.list_scheduled_broadcasts(status="SCHEDULED")
        except Exception as e:
            logger.debug(f"Could not list scheduled broadcasts: {e}")
            return []

        for item in scheduled_items:
            if not item.scheduled_at:
                continue

            try:
                sched_dt = datetime.fromisoformat(item.scheduled_at.replace("Z", "+00:00"))
                if sched_dt.tzinfo is None:
                    sched_dt = sched_dt.replace(tzinfo=timezone.utc)
            except Exception as dt_err:
                logger.warning(f"Invalid scheduled_at timestamp on broadcast {item.id}: {dt_err}")
                continue

            if sched_dt <= now_dt:
                logger.info(
                    f"Triggering scheduled broadcast '{item.name or item.id}' (scheduled: {item.scheduled_at}, recurrence: {item.recurrence})"
                )
                item.status = "RUNNING"
                await self.job_repo.update_scheduled_broadcast(item)

                try:
                    res = await self.gateway.broadcast_message(
                        target_ids=item.target_ids,
                        text=item.text,
                        media_paths=item.media_paths if item.media_paths else None,
                        account_id=item.account_id,
                    )
                    triggered_ids.append(item.id)

                    item.last_run_at = now_dt.isoformat()
                    item.run_count += 1
                    item.last_error = None

                    if self.audit_repo:
                        try:
                            await self.audit_repo.record_audit_log(
                                AuditLog(
                                    id=None,
                                    user_id=None,
                                    user_email=None,
                                    action="SCHEDULED_BROADCAST_EXECUTED",
                                    resource=f"broadcast:{item.id}",
                                    details={
                                        "target_count": len(item.target_ids),
                                        "successful_count": res.get("successful_count", 0),
                                        "failed_count": res.get("failed_count", 0),
                                        "recurrence": item.recurrence,
                                        "run_count": item.run_count,
                                    },
                                )
                            )
                        except Exception as ae:
                            logger.warning(f"Could not write audit log for scheduled broadcast: {ae}")

                    if self.broadcaster and hasattr(self.broadcaster, "broadcast"):
                        try:
                            await self.broadcaster.broadcast(
                                "broadcast_event",
                                {
                                    "type": "scheduled_broadcast_executed",
                                    "campaign_id": item.id,
                                    "successful_count": res.get("successful_count", 0),
                                    "failed_count": res.get("failed_count", 0),
                                },
                            )
                        except Exception:
                            pass

                except Exception as ex:
                    logger.error(f"Failed to execute scheduled broadcast {item.id}: {ex}", exc_info=True)
                    item.last_error = str(ex)

                    if self.alerting_service and hasattr(self.alerting_service, "notify_broadcast_failure"):
                        try:
                            asyncio.create_task(
                                self.alerting_service.notify_broadcast_failure(
                                    campaign_name=item.name,
                                    campaign_id=item.id,
                                    target_count=len(item.target_ids),
                                    error_details=str(ex),
                                )
                            )
                        except Exception as ae:
                            logger.debug(f"Broadcast: Alerting suppressed: {ae}")

                # Compute next schedule or mark completed
                if item.recurrence == "ONCE":
                    item.status = "COMPLETED" if item.last_error is None else "FAILED"
                else:
                    item.status = "SCHEDULED"
                    next_dt = self._calculate_next_run(sched_dt, item.recurrence, now_dt)
                    item.scheduled_at = next_dt.isoformat()

                await self.job_repo.update_scheduled_broadcast(item)

        return triggered_ids

    def _calculate_next_run(
        self, base_dt: datetime, recurrence: str, now_dt: datetime
    ) -> datetime:
        interval = timedelta(days=1)
        if recurrence == "EVERY_6_HOURS":
            interval = timedelta(hours=6)
        elif recurrence == "EVERY_12_HOURS":
            interval = timedelta(hours=12)
        elif recurrence == "DAILY":
            interval = timedelta(days=1)
        elif recurrence == "WEEKLY":
            interval = timedelta(days=7)

        next_dt = base_dt + interval
        while next_dt <= now_dt:
            next_dt += interval
        return next_dt
