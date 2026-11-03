from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any

from backend.domain.entities.migration_job import JobStatus
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase
from backend.application.broadcaster import EventBroadcaster

logger = logging.getLogger(__name__)


class JobSchedulerService:
    """Background service that periodically polls for scheduled migration jobs and triggers them."""

    def __init__(
        self,
        job_repo: JobRepositoryPort,
        use_case: CloneChannelVideosUseCase,
        broadcaster: EventBroadcaster,
        poll_interval: float = 10.0,
    ) -> None:
        self.job_repo = job_repo
        self.use_case = use_case
        self.broadcaster = broadcaster
        self.poll_interval = poll_interval
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("JobSchedulerService background polling loop started.")

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("JobSchedulerService background polling loop stopped.")

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                await self.check_and_trigger_scheduled_jobs()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Error in JobSchedulerService loop: {e}")
            await asyncio.sleep(self.poll_interval)

    async def check_and_trigger_scheduled_jobs(self) -> list[str]:
        now_dt = datetime.now(timezone.utc)
        triggered_job_ids: list[str] = []

        try:
            scheduled_jobs, _ = await self.job_repo.list_jobs(
                limit=100, offset=0, status=JobStatus.SCHEDULED
            )
        except Exception as e:
            logger.debug(f"Could not list scheduled jobs: {e}")
            return []

        for job in scheduled_jobs:
            if not job.scheduled_at:
                continue
            try:
                sched_dt = datetime.fromisoformat(job.scheduled_at.replace("Z", "+00:00"))
                if sched_dt.tzinfo is None:
                    sched_dt = sched_dt.replace(tzinfo=timezone.utc)
            except Exception:
                continue

            if sched_dt <= now_dt:
                logger.info(f"Triggering scheduled job {job.job_id} (scheduled: {job.scheduled_at})")
                try:
                    await self.job_repo.set_job_status(job.job_id, JobStatus.RUNNING)
                    from backend.presentation.api.routers.jobs import _dispatch_worker
                    selected_ids = None
                    if job.media_filter_rules and isinstance(job.media_filter_rules, dict):
                        selected_ids = job.media_filter_rules.get("selected_message_ids")

                    _dispatch_worker(
                        job_id=job.job_id,
                        use_case=self.use_case,
                        repo=self.job_repo,
                        broadcaster=self.broadcaster,
                        selected_message_ids=selected_ids,
                    )
                    triggered_job_ids.append(job.job_id)
                except Exception as ex:
                    logger.error(f"Failed to dispatch scheduled job {job.job_id}: {ex}")

        return triggered_job_ids
