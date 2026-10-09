from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, Awaitable, Callable

from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.exceptions.domain_exceptions import (
    FloodWaitDomainException,
    JobNotFoundException,
)
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[dict[str, Any]], Awaitable[None]]


class CloneChannelVideosUseCase:
    """Orchestrates cloning videos from source to target channel with rate-limiting and recovery."""

    def __init__(
        self,
        telegram_gateway: TelegramGatewayPort,
        job_repository: JobRepositoryPort,
        min_delay_seconds: float = 1.5,
        max_delay_seconds: float = 2.0,
    ) -> None:
        self.gateway = telegram_gateway
        self.repo = job_repository
        self.min_delay = min_delay_seconds
        self.max_delay = max_delay_seconds
        self._cancelled_jobs: set[str] = set()

    def cancel_job(self, job_id: str) -> None:
        """Mark a job ID to abort on next iteration."""
        self._cancelled_jobs.add(job_id)

    async def execute(
        self, job_id: str, on_progress: ProgressCallback | None = None
    ) -> MigrationJob:
        """Executes sequential video migration for a given job."""
        job = await self.repo.get_job(job_id)
        if not job:
            raise JobNotFoundException(job_id)

        await self.repo.set_job_status(job_id, JobStatus.RUNNING)
        if on_progress:
            await on_progress({
                "job_id": job_id,
                "status": JobStatus.RUNNING.value,
                "message": "Discovering videos in source channel...",
                "processed_videos": job.processed_videos,
                "total_videos": job.total_videos,
                "percentage": 0.0,
            })

        # Fetch video messages from source channel
        videos = await self.gateway.fetch_channel_videos(job.source_id)
        total_videos = len(videos)

        # Update initial totals
        job.total_videos = total_videos
        await self.repo.create_job(job)

        if total_videos == 0:
            await self.repo.set_job_status(job_id, JobStatus.COMPLETED)
            if on_progress:
                await on_progress({
                    "job_id": job_id,
                    "status": JobStatus.COMPLETED.value,
                    "message": "No videos found in source channel.",
                    "processed_videos": 0,
                    "total_videos": 0,
                    "percentage": 100.0,
                })
            return job

        processed_count = 0

        for video in videos:
            if job_id in self._cancelled_jobs:
                await self.repo.set_job_status(job_id, JobStatus.CANCELLED)
                if on_progress:
                    await on_progress({
                        "job_id": job_id,
                        "status": JobStatus.CANCELLED.value,
                        "message": "Migration cancelled by user.",
                        "processed_videos": processed_count,
                        "total_videos": total_videos,
                        "percentage": round((processed_count / total_videos) * 100, 1),
                    })
                return await self.repo.get_job(job_id)  # type: ignore

            # Idempotency check: skip already migrated messages
            already_migrated = await self.repo.is_item_migrated(job_id, video.message_id)
            if already_migrated:
                processed_count += 1
                continue

            target_msg_id = None
            while target_msg_id is None:
                try:
                    target_msg_id = await self.gateway.copy_video_by_reference(
                        job.target_id, video
                    )
                except FloodWaitDomainException as fw:
                    wait_time = fw.seconds + 2
                    logger.warning(
                        f"Flood wait encountered on job {job_id}. Pausing for {wait_time}s..."
                    )
                    await self.repo.set_job_status(job_id, JobStatus.PAUSED_FLOOD_WAIT)
                    if on_progress:
                        await on_progress({
                            "job_id": job_id,
                            "status": JobStatus.PAUSED_FLOOD_WAIT.value,
                            "message": f"Telegram rate limit: cooling down for {wait_time}s...",
                            "wait_seconds": wait_time,
                            "processed_videos": processed_count,
                            "total_videos": total_videos,
                            "percentage": round((processed_count / total_videos) * 100, 1),
                        })
                    await asyncio.sleep(wait_time)
                    await self.repo.set_job_status(job_id, JobStatus.RUNNING)

            # Record item in SQLite and update progress
            await self.repo.record_migrated_item(job_id, video.message_id, target_msg_id)
            processed_count += 1
            await self.repo.update_job_progress(job_id, processed_count, video.message_id)

            caption_snippet = video.caption[:50].replace("\n", " ") if video.caption else "Video without caption"
            percentage = round((processed_count / total_videos) * 100, 1)

            if on_progress:
                await on_progress({
                    "job_id": job_id,
                    "status": JobStatus.RUNNING.value,
                    "message": f"Copied video #{video.message_id} -> {caption_snippet}",
                    "processed_videos": processed_count,
                    "total_videos": total_videos,
                    "percentage": percentage,
                })

            # Enforce safe delay between messages
            delay = random.uniform(self.min_delay, self.max_delay)
            await asyncio.sleep(delay)

        await self.repo.set_job_status(job_id, JobStatus.COMPLETED)
        if on_progress:
            await on_progress({
                "job_id": job_id,
                "status": JobStatus.COMPLETED.value,
                "message": f"Migration completed successfully ({processed_count}/{total_videos} videos).",
                "processed_videos": processed_count,
                "total_videos": total_videos,
                "percentage": 100.0,
            })

        final_job = await self.repo.get_job(job_id)
        return final_job or job
