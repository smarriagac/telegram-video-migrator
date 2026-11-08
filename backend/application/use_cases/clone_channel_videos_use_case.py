from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any, Awaitable, Callable

from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.entities.video_message import VideoMessage
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
        rate_governor: Any | None = None,
    ) -> None:
        self.gateway = telegram_gateway
        self.repo = job_repository
        self.min_delay = min_delay_seconds
        self.max_delay = max_delay_seconds
        self.rate_governor = rate_governor
        self._cancelled_jobs: set[str] = set()

    def cancel_job(self, job_id: str) -> None:
        """Mark a job ID to abort on next iteration."""
        self._cancelled_jobs.add(job_id)

    def resume_job(self, job_id: str) -> None:
        """Remove a job ID from cancellation so it can run again."""
        self._cancelled_jobs.discard(job_id)

    async def execute(
        self,
        job_id: str,
        on_progress: ProgressCallback | None = None,
        selected_message_ids: list[int] | None = None,
    ) -> MigrationJob:
        """Executes sequential video migration for a given job using persistent queue."""
        job = await self.repo.get_job(job_id)
        if not job:
            raise JobNotFoundException(job_id)

        # Recover selected_message_ids from job metadata if omitted (e.g. scheduled or run-now)
        if selected_message_ids is None and getattr(job, "media_filter_rules", None):
            if isinstance(job.media_filter_rules, dict) and "selected_message_ids" in job.media_filter_rules:
                selected_message_ids = job.media_filter_rules["selected_message_ids"]

        await self.repo.set_job_status(job_id, JobStatus.RUNNING)
        if on_progress:
            await on_progress({
                "job_id": job_id,
                "status": JobStatus.RUNNING.value,
                "message": "Initializing migration queue...",
                "processed_videos": job.processed_videos,
                "total_videos": job.total_videos,
                "percentage": 0.0,
            })

        # Check if queue already exists (e.g. resuming)
        existing_queue = await self.repo.get_queue_items(job_id)
        videos_cache: dict[int, VideoMessage] = {}

        if not existing_queue:
            # Discover messages from source channel
            if getattr(job, "source_account_id", None) is not None:
                try:
                    all_videos = await self.gateway.fetch_channel_videos(
                        job.source_id, account_id=job.source_account_id
                    )
                except TypeError:
                    all_videos = await self.gateway.fetch_channel_videos(job.source_id)
            else:
                all_videos = await self.gateway.fetch_channel_videos(job.source_id)
            if selected_message_ids is not None:
                selected_set = set(selected_message_ids)
                videos_to_queue = [v for v in all_videos if v.message_id in selected_set]
            else:
                videos_to_queue = all_videos

            queue_items = [
                QueueItem(
                    job_id=job_id,
                    source_message_id=v.message_id,
                    status=QueueItemStatus.PENDING,
                    media_type=getattr(v, "media_type", "video"),
                    caption=v.caption or "",
                )
                for v in videos_to_queue
            ]
            await self.repo.add_queue_items(queue_items)
            videos_cache = {v.message_id: v for v in videos_to_queue}
            total_items = len(queue_items)
            job.total_videos = total_items
            await self.repo.create_job(job)
        else:
            total_items = len(existing_queue)
            job.total_videos = total_items
            try:
                if getattr(job, "source_account_id", None) is not None:
                    try:
                        all_videos = await self.gateway.fetch_channel_videos(
                            job.source_id, account_id=job.source_account_id
                        )
                    except TypeError:
                        all_videos = await self.gateway.fetch_channel_videos(job.source_id)
                else:
                    all_videos = await self.gateway.fetch_channel_videos(job.source_id)
                videos_cache = {v.message_id: v for v in all_videos}
            except Exception as e:
                logger.warning(f"Could not warm up videos_cache on existing queue: {e}")

        if total_items == 0:
            await self.repo.set_job_status(job_id, JobStatus.COMPLETED)
            if on_progress:
                await on_progress({
                    "job_id": job_id,
                    "status": JobStatus.COMPLETED.value,
                    "message": "No messages or media found in queue.",
                    "processed_videos": 0,
                    "total_videos": 0,
                    "percentage": 100.0,
                })
            return job

        while True:
            if job_id in self._cancelled_jobs:
                await self.repo.set_job_status(job_id, JobStatus.CANCELLED)
                stats = await self.repo.get_queue_stats(job_id)
                processed = stats["completed"] + stats["failed"] + stats["skipped"]
                if on_progress:
                    await on_progress({
                        "job_id": job_id,
                        "status": JobStatus.CANCELLED.value,
                        "message": "Migration cancelled by user.",
                        "processed_videos": processed,
                        "total_videos": total_items,
                        "percentage": round((processed / total_items) * 100, 1) if total_items > 0 else 0,
                        "queue_stats": stats,
                    })
                return await self.repo.get_job(job_id)  # type: ignore

            item = await self.repo.get_next_pending_queue_item(job_id)
            if not item:
                break

            await self.repo.update_queue_item_status(
                job_id, item.source_message_id, QueueItemStatus.IN_PROGRESS
            )

            # Idempotency check: skip already migrated messages
            already_migrated = await self.repo.is_item_migrated(job_id, item.source_message_id)
            if already_migrated:
                await self.repo.update_queue_item_status(
                    job_id, item.source_message_id, QueueItemStatus.COMPLETED
                )
                stats = await self.repo.get_queue_stats(job_id)
                processed_count = stats["completed"] + stats["failed"] + stats["skipped"]
                await self.repo.update_job_progress(job_id, processed_count, item.source_message_id)
                continue

            video = videos_cache.get(item.source_message_id)
            if not video:
                video = VideoMessage(
                    message_id=item.source_message_id,
                    caption=item.caption,
                    media_type=item.media_type,
                    source_channel_id=job.source_id,
                )

            # Caption transformation pipeline
            if getattr(job, "caption_rules", None):
                try:
                    from backend.application.services.caption_transformer_service import CaptionTransformerService
                    from backend.domain.entities.caption_rules import CaptionRules
                    rules_entity = (
                        CaptionRules(**job.caption_rules)
                        if isinstance(job.caption_rules, dict)
                        else job.caption_rules
                    )
                    video.caption = CaptionTransformerService().transform(video.caption or "", rules_entity)
                except Exception as ex:
                    logger.warning(f"Failed to transform caption for item #{item.source_message_id}: {ex}")

            # Quality & Metadata Filter Gates
            if getattr(job, "media_filter_rules", None):
                try:
                    from backend.application.services.media_filter_service import MediaFilterService
                    from backend.domain.entities.media_filter_rules import MediaFilterRules
                    filter_rules = (
                        MediaFilterRules(**job.media_filter_rules)
                        if isinstance(job.media_filter_rules, dict)
                        else job.media_filter_rules
                    )
                    passes, reject_reason = MediaFilterService().evaluate(video, filter_rules)
                    if not passes:
                        logger.info(
                            f"Quality Filter: Saltado mensaje #{item.source_message_id} ({reject_reason})"
                        )
                        await self.repo.update_queue_item_status(
                            job_id, item.source_message_id, QueueItemStatus.SKIPPED, error_message=reject_reason
                        )
                        stats = await self.repo.get_queue_stats(job_id)
                        processed_count = stats["completed"] + stats["failed"] + stats["skipped"]
                        await self.repo.update_job_progress(job_id, processed_count, item.source_message_id)
                        if on_progress:
                            await on_progress({
                                "job_id": job_id,
                                "status": JobStatus.RUNNING.value,
                                "message": f"Filtro Calidad: Saltado #{item.source_message_id} ({reject_reason})",
                                "processed_videos": processed_count,
                                "total_videos": total_items,
                                "percentage": round((processed_count / total_items) * 100, 1) if total_items > 0 else 100.0,
                                "queue_stats": stats,
                            })
                        continue
                except Exception as ex:
                    logger.warning(f"Error evaluating media filter rules for #{item.source_message_id}: {ex}")

            # Perceptual / structural duplicate guard & Fast-Forward Engine
            from backend.application.services.fingerprint_service import FingerprintService
            fp_svc = FingerprintService()
            fp_hash = fp_svc.compute_fingerprint(
                media_type=video.media_type,
                input_document_id=getattr(video, "input_document_id", None),
                file_size=getattr(video, "file_size", None),
                duration=getattr(video, "duration", None),
                width=getattr(video, "width", None),
                height=getattr(video, "height", None),
                caption=video.caption,
            )
            existing_target_record: dict[str, Any] | None = None
            if fp_hash and hasattr(self.repo, "get_media_fingerprint"):
                fp_res = self.repo.get_media_fingerprint(job.target_id, fp_hash)
                existing_target_record = await fp_res if (asyncio.iscoroutine(fp_res) or hasattr(fp_res, "__await__")) else fp_res
            elif fp_hash:
                check_call = self.repo.is_media_fingerprint_duplicated(job.target_id, fp_hash)
                is_dup = await check_call if (asyncio.iscoroutine(check_call) or hasattr(check_call, "__await__")) else bool(check_call)
                if is_dup:
                    existing_target_record = {"target_message_id": None}

            if existing_target_record:
                matched_target_msg_id = existing_target_record.get("target_message_id")
                logger.info(
                    f"Fast-Forward Engine: media already present in target #{job.target_id} for source msg #{item.source_message_id} (target_msg_id={matched_target_msg_id}, hash={fp_hash[:10]}). Skipping re-upload."
                )
                await self.repo.update_queue_item_status(
                    job_id,
                    item.source_message_id,
                    QueueItemStatus.COMPLETED,
                    target_msg_id=matched_target_msg_id,
                    error_message=f"Fast-Forward: Ya existe en destino #{job.target_id}" + (f" (msg #{matched_target_msg_id})" if matched_target_msg_id else ""),
                    is_deduplicated=True,
                )
                stats = await self.repo.get_queue_stats(job_id)
                processed_count = stats["completed"] + stats["failed"] + stats["skipped"]
                await self.repo.update_job_progress(job_id, processed_count, item.source_message_id)
                if on_progress:
                    await on_progress({
                        "job_id": job_id,
                        "status": JobStatus.RUNNING.value,
                        "message": f"Fast-Forward: Mensaje #{item.source_message_id} deduplicado (0 bytes transferidos)",
                        "processed_videos": processed_count,
                        "total_videos": total_items,
                        "percentage": round((processed_count / total_items) * 100, 1) if total_items > 0 else 100.0,
                        "queue_stats": stats,
                    })
                continue

            target_msg_id = None
            retry_count = 0
            max_retries = 2
            last_error: str | None = None

            is_cross_account = (
                getattr(job, "source_account_id", None) is not None
                and getattr(job, "target_account_id", None) is not None
                and job.source_account_id != job.target_account_id
            )

            current_target_account = getattr(job, "target_account_id", None) or getattr(job, "source_account_id", None)
            drip_delay_sec = float(getattr(job, "drip_delay_seconds", 0) or 0)
            if self.rate_governor:
                await self.rate_governor.acquire(
                    current_target_account, job.target_id, requested_delay=drip_delay_sec
                )

            t0 = time.monotonic()
            while target_msg_id is None and retry_count <= max_retries:
                try:
                    if is_cross_account:
                        target_msg_id = await self.gateway.copy_media_cross_account(
                            source_channel_id=job.source_id,
                            target_channel_id=job.target_id,
                            video=video,
                            source_account_id=job.source_account_id,  # type: ignore
                            target_account_id=current_target_account,  # type: ignore
                        )
                    else:
                        acc_id = current_target_account
                        if acc_id is not None:
                            try:
                                target_msg_id = await self.gateway.copy_video_by_reference(
                                    job.target_id, video, account_id=acc_id
                                )
                            except TypeError:
                                target_msg_id = await self.gateway.copy_video_by_reference(
                                    job.target_id, video
                                )
                        else:
                            target_msg_id = await self.gateway.copy_video_by_reference(
                                job.target_id, video
                            )
                except FloodWaitDomainException as fw:
                    wait_time = fw.seconds + 2
                    logger.warning(
                        f"Flood wait encountered on job {job_id} for account #{current_target_account}: {fw.seconds}s"
                    )
                    if self.rate_governor:
                        await self.rate_governor.report_feedback(
                            current_target_account,
                            job.target_id,
                            success=False,
                            flood_wait_seconds=fw.seconds,
                        )

                    # Attempt Hot-Failover to an alternative connected account
                    rotated = None
                    if hasattr(self.gateway, "rotate_account_on_flood_wait"):
                        rotate_call = self.gateway.rotate_account_on_flood_wait(
                            account_id=current_target_account,
                            flood_wait_seconds=fw.seconds,
                            tenant_id=getattr(job, "tenant_id", None),
                        )
                        rotated = await rotate_call if (asyncio.iscoroutine(rotate_call) or hasattr(rotate_call, "__await__")) else rotate_call

                    if rotated:
                        new_acc_id, new_acc_name = rotated
                        prev_acc = current_target_account
                        current_target_account = new_acc_id
                        job.target_account_id = new_acc_id
                        new_failover_count = getattr(job, "failover_count", 0) + 1
                        job.failover_count = new_failover_count

                        if hasattr(self.repo, "update_job_failover"):
                            upd_call = self.repo.update_job_failover(job_id, new_acc_id, new_failover_count)
                            if asyncio.iscoroutine(upd_call) or hasattr(upd_call, "__await__"):
                                await upd_call

                        logger.info(
                            f"Hot Failover: Job {job_id} rotated from account #{prev_acc} to #{new_acc_id} ('{new_acc_name}') due to FloodWait({fw.seconds}s). Continuing without pausing!"
                        )
                        if on_progress:
                            await on_progress({
                                "job_id": job_id,
                                "status": JobStatus.RUNNING.value,
                                "message": f"Hot Failover: Rotada cuenta a #{new_acc_id} ({new_acc_name}) por FloodWait ({fw.seconds}s)",
                                "failover_count": new_failover_count,
                                "active_account_id": new_acc_id,
                            })
                        # Immediately continue loop with the newly assigned account without pausing or sleeping!
                        continue

                    # Fallback when no alternative account is available: pause and wait cooldown
                    await self.repo.set_job_status(job_id, JobStatus.PAUSED_FLOOD_WAIT)
                    if on_progress:
                        await on_progress({
                            "job_id": job_id,
                            "status": JobStatus.PAUSED_FLOOD_WAIT.value,
                            "message": f"Telegram rate limit: cooling down for {wait_time}s...",
                            "wait_seconds": wait_time,
                        })
                    await asyncio.sleep(wait_time)
                    await self.repo.set_job_status(job_id, JobStatus.RUNNING)
                except Exception as ex:
                    retry_count += 1
                    last_error = str(ex)
                    logger.warning(
                        f"Attempt {retry_count}/{max_retries} failed for message #{item.source_message_id} on job {job_id}: {ex}"
                    )
                    if retry_count > max_retries:
                        logger.error(
                            f"Skipping message #{item.source_message_id} due to persistent error: {ex}"
                        )
                        break
                    await asyncio.sleep(2.0)

            if target_msg_id is not None:
                latency_ms = (time.monotonic() - t0) * 1000.0
                if self.rate_governor:
                    await self.rate_governor.report_feedback(
                        target_account,
                        job.target_id,
                        success=True,
                        latency_ms=latency_ms,
                    )
                await self.repo.record_migrated_item(job_id, item.source_message_id, target_msg_id)
                if fp_hash and hasattr(self.repo, "record_media_fingerprint"):
                    record_call = self.repo.record_media_fingerprint(
                        target_channel_id=job.target_id,
                        fingerprint_hash=fp_hash,
                        source_channel_id=job.source_id,
                        source_message_id=item.source_message_id,
                        target_message_id=target_msg_id,
                        media_type=item.media_type,
                    )
                    if asyncio.iscoroutine(record_call) or hasattr(record_call, "__await__"):
                        await record_call
                await self.repo.update_queue_item_status(
                    job_id,
                    item.source_message_id,
                    QueueItemStatus.COMPLETED,
                    target_msg_id=target_msg_id,
                )
            else:
                await self.repo.update_queue_item_status(
                    job_id,
                    item.source_message_id,
                    QueueItemStatus.FAILED,
                    error_message=last_error,
                )

            stats = await self.repo.get_queue_stats(job_id)
            processed_count = stats["completed"] + stats["failed"] + stats["skipped"]
            await self.repo.update_job_progress(job_id, processed_count, item.source_message_id)

            media_label = item.media_type.capitalize()
            caption_snippet = item.caption[:50].replace("\n", " ") if item.caption else f"{media_label} without caption"
            percentage = round((processed_count / total_items) * 100, 1) if total_items > 0 else 100.0

            if on_progress:
                await on_progress({
                    "job_id": job_id,
                    "status": JobStatus.RUNNING.value,
                    "message": f"Copied {media_label} #{item.source_message_id} -> {caption_snippet}",
                    "processed_videos": processed_count,
                    "total_videos": total_items,
                    "percentage": percentage,
                    "queue_stats": stats,
                })

            if not self.rate_governor:
                drip_delay = getattr(job, "drip_delay_seconds", 0) or 0
                if drip_delay > 0:
                    if on_progress:
                        await on_progress({
                            "job_id": job_id,
                            "status": JobStatus.RUNNING.value,
                            "message": f"Drip Feed: esperando {drip_delay}s antes del próximo envío...",
                            "processed_videos": processed_count,
                            "total_videos": total_items,
                            "percentage": percentage,
                            "queue_stats": stats,
                        })
                    waited = 0.0
                    while waited < drip_delay:
                        if job_id in self._cancelled_jobs:
                            break
                        sleep_chunk = min(2.0, drip_delay - waited)
                        await asyncio.sleep(sleep_chunk)
                        waited += sleep_chunk
                else:
                    delay = random.uniform(self.min_delay, self.max_delay)
                    await asyncio.sleep(delay)

        final_stats = await self.repo.get_queue_stats(job_id)
        final_status = JobStatus.COMPLETED if final_stats["failed"] == 0 else JobStatus.COMPLETED
        await self.repo.set_job_status(job_id, final_status)
        processed_final = final_stats["completed"] + final_stats["failed"] + final_stats["skipped"]

        if on_progress:
            await on_progress({
                "job_id": job_id,
                "status": final_status.value,
                "message": f"Migration completed ({final_stats['completed']} succeeded, {final_stats['failed']} failed).",
                "processed_videos": processed_final,
                "total_videos": total_items,
                "percentage": 100.0,
                "queue_stats": final_stats,
            })

        final_job = await self.repo.get_job(job_id)
        return final_job or job
