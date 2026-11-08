from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from backend.application.broadcaster import EventBroadcaster
from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.audit_log import AuditLog
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.presentation.dependencies import (
    get_broadcaster,
    get_job_repository,
    get_migration_use_case,
    get_audit_repository,
    get_crash_recovery_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["Jobs"])


class CreateJobRequest(BaseModel):
    source_channel_id: int
    target_channel_id: int
    selected_message_ids: list[int] | None = None
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    caption_rules: dict | None = None
    drip_delay_seconds: int = 0
    media_filter_rules: dict | None = None
    scheduled_at: str | None = None


class JobResponse(BaseModel):
    job_id: str
    source_id: int
    target_id: int
    status: str
    total_videos: int
    processed_videos: int
    last_processed_id: int | None = None
    created_at: str | None = None
    scheduled_at: str | None = None
    is_full_migration: bool = True
    source_title: str | None = None
    target_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    caption_rules: dict | None = None
    drip_delay_seconds: int = 0
    media_filter_rules: dict | None = None


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    page_size: int


def _to_job_response(job: MigrationJob) -> JobResponse:
    return JobResponse(
        job_id=job.job_id,
        source_id=job.source_id,
        target_id=job.target_id,
        status=job.status.value if isinstance(job.status, JobStatus) else str(job.status),
        total_videos=job.total_videos,
        processed_videos=job.processed_videos,
        last_processed_id=job.last_processed_id,
        created_at=job.created_at,
        scheduled_at=job.scheduled_at,
        is_full_migration=job.is_full_migration,
        source_title=job.source_title,
        target_title=job.target_title,
        source_account_id=job.source_account_id,
        target_account_id=job.target_account_id,
        caption_rules=job.caption_rules,
        drip_delay_seconds=job.drip_delay_seconds,
        media_filter_rules=job.media_filter_rules,
    )


def _dispatch_worker(
    job_id: str,
    use_case: CloneChannelVideosUseCase,
    repo: JobRepositoryPort,
    broadcaster: EventBroadcaster,
    selected_message_ids: list[int] | None = None,
):
    use_case.resume_job(job_id)

    async def on_progress(event: dict[str, Any]):
        await broadcaster.publish(job_id, event)

    async def run_worker():
        try:
            await use_case.execute(
                job_id=job_id,
                on_progress=on_progress,
                selected_message_ids=selected_message_ids,
            )
        except Exception as e:
            logger.error(f"Migration worker failed for job {job_id}: {e}")
            await repo.set_job_status(job_id, JobStatus.FAILED)
            await broadcaster.publish(
                job_id,
                {
                    "job_id": job_id,
                    "status": JobStatus.FAILED.value,
                    "message": f"Worker error: {str(e)}",
                },
            )
            try:
                from backend.presentation.dependencies import get_alerting_service
                alerting = await get_alerting_service()
                await alerting.send_alert(
                    title=f"Fallo en Job de Migración",
                    message=f"Job {job_id[:8]} terminó en error: {str(e)}",
                    severity="ERROR",
                    recipient=os.getenv("ALERT_TELEGRAM_RECIPIENT", "@Smpyt"),
                )
            except Exception:
                pass

    asyncio.create_task(run_worker())


class QueueItemResponse(BaseModel):
    job_id: str
    source_message_id: int
    status: str
    media_type: str
    caption: str
    target_message_id: int | None = None
    error_message: str | None = None
    retry_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class JobQueueStatusResponse(BaseModel):
    job_id: str
    stats: dict[str, int]
    items: list[QueueItemResponse]


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def start_job(
    req: CreateJobRequest,
    repo: JobRepositoryPort = Depends(get_job_repository),
    use_case: CloneChannelVideosUseCase = Depends(get_migration_use_case),
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> JobResponse:
    """Create and start a new video migration job."""
    if req.source_channel_id == req.target_channel_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target channels must be different.",
        )

    job_id = str(uuid.uuid4())
    is_full = True if req.selected_message_ids is None or len(req.selected_message_ids) == 0 else False
    is_scheduled = bool(req.scheduled_at)
    initial_status = JobStatus.SCHEDULED if is_scheduled else JobStatus.PENDING

    # Preserve selected_message_ids in media_filter_rules metadata so it survives scheduling, pause/resume and run-now
    filter_rules = dict(req.media_filter_rules or {})
    if req.selected_message_ids and len(req.selected_message_ids) > 0:
        filter_rules["selected_message_ids"] = req.selected_message_ids

    total_count = len(req.selected_message_ids) if req.selected_message_ids else 0

    job = MigrationJob(
        job_id=job_id,
        source_id=req.source_channel_id,
        target_id=req.target_channel_id,
        status=initial_status,
        total_videos=total_count,
        is_full_migration=is_full,
        source_title=req.source_channel_title,
        target_title=req.target_channel_title,
        source_account_id=req.source_account_id,
        target_account_id=req.target_account_id,
        caption_rules=req.caption_rules,
        drip_delay_seconds=req.drip_delay_seconds,
        media_filter_rules=filter_rules,
        scheduled_at=req.scheduled_at,
    )
    await repo.create_job(job)

    try:
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=None,
                user_email=None,
                action="MIGRATION_SCHEDULED" if is_scheduled else "MIGRATION_START",
                resource=f"job:{job_id}",
                details={
                    "source_id": req.source_channel_id,
                    "target_id": req.target_channel_id,
                    "source_title": req.source_channel_title,
                    "target_title": req.target_channel_title,
                    "is_full_migration": is_full,
                    "selected_items_count": len(req.selected_message_ids) if req.selected_message_ids else "all",
                    "caption_rules": req.caption_rules,
                    "drip_delay_seconds": req.drip_delay_seconds,
                    "media_filter_rules": req.media_filter_rules,
                    "scheduled_at": req.scheduled_at,
                },
            )
        )
    except Exception as e:
        logger.warning(f"Could not record audit log for migration start: {e}")

    if not is_scheduled:
        _dispatch_worker(
            job_id=job_id,
            use_case=use_case,
            repo=repo,
            broadcaster=broadcaster,
            selected_message_ids=req.selected_message_ids,
        )

    return _to_job_response(job)


@router.get("", response_model=JobListResponse)
async def list_jobs(
    page: int = 1,
    page_size: int = 20,
    status_filter: str | None = None,
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> JobListResponse:
    """List migration jobs with pagination and optional status filter."""
    limit = max(1, min(page_size, 100))
    offset = max(0, (page - 1) * limit)
    st = None
    if status_filter and status_filter.upper() != "ALL":
        try:
            st = JobStatus(status_filter.upper())
        except ValueError:
            st = None
    jobs, total = await repo.list_jobs(limit=limit, offset=offset, status=st)
    return JobListResponse(
        items=[_to_job_response(j) for j in jobs],
        total=total,
        page=page,
        page_size=limit,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> JobResponse:
    """Get status and metrics for an existing migration job."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )

    return JobResponse(
        job_id=job.job_id,
        source_id=job.source_id,
        target_id=job.target_id,
        status=job.status.value,
        total_videos=job.total_videos,
        processed_videos=job.processed_videos,
        last_processed_id=job.last_processed_id,
        created_at=job.created_at,
        is_full_migration=job.is_full_migration,
        source_title=job.source_title,
        target_title=job.target_title,
        source_account_id=job.source_account_id,
        target_account_id=job.target_account_id,
        caption_rules=job.caption_rules,
        drip_delay_seconds=job.drip_delay_seconds,
        media_filter_rules=job.media_filter_rules,
    )


@router.get("/{job_id}/queue", response_model=JobQueueStatusResponse)
async def get_job_queue(
    job_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> JobQueueStatusResponse:
    """Retrieve detailed queue items and aggregate statistics for a job."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )

    stats = await repo.get_queue_stats(job_id)
    items = await repo.get_queue_items(job_id)
    return JobQueueStatusResponse(
        job_id=job_id,
        stats=stats,
        items=[
            QueueItemResponse(
                job_id=it.job_id,
                source_message_id=it.source_message_id,
                status=it.status.value,
                media_type=it.media_type,
                caption=it.caption,
                target_message_id=it.target_message_id,
                error_message=it.error_message,
                retry_count=it.retry_count,
                created_at=it.created_at,
                updated_at=it.updated_at,
            )
            for it in items
        ],
    )


@router.get("/{job_id}/stream")
async def stream_job_progress(
    job_id: str,
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> EventSourceResponse:
    """Server-Sent Events (SSE) streaming endpoint for live job progress."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )

    async def event_generator():
        # First send initial current state
        yield {
            "event": "progress",
            "data": json.dumps({
                "job_id": job.job_id,
                "status": job.status.value,
                "total_videos": job.total_videos,
                "processed_videos": job.processed_videos,
                "percentage": round((job.processed_videos / job.total_videos) * 100, 1) if job.total_videos else 0.0,
                "message": f"Connected to live stream for job {job.job_id}",
            }),
        }

        # If job is already terminal, finish immediately
        if job.status in {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED}:
            return

        async for event in broadcaster.subscribe(job_id):
            yield {
                "event": "progress",
                "data": json.dumps(event),
            }

    return EventSourceResponse(event_generator())


@router.post("/{job_id}/cancel", response_model=dict[str, str])
async def cancel_job(
    job_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
    use_case: CloneChannelVideosUseCase = Depends(get_migration_use_case),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> dict[str, str]:
    """Request graceful cancellation of an active migration job."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )

    use_case.cancel_job(job_id)
    await repo.set_job_status(job_id, JobStatus.CANCELLED)
    try:
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=None,
                user_email=None,
                action="MIGRATION_CANCEL",
                resource=f"job:{job_id}",
            )
        )
    except Exception:
        pass
    return {"job_id": job_id, "status": JobStatus.CANCELLED.value}


@router.post("/{job_id}/pause", response_model=dict[str, str])
async def pause_job(
    job_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
    use_case: CloneChannelVideosUseCase = Depends(get_migration_use_case),
) -> dict[str, str]:
    """Pause an active migration job."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    use_case.cancel_job(job_id)
    await repo.set_job_status(job_id, JobStatus.PAUSED)
    return {"job_id": job_id, "status": JobStatus.PAUSED.value}


@router.post("/{job_id}/resume", response_model=JobResponse)
async def resume_job(
    job_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
    use_case: CloneChannelVideosUseCase = Depends(get_migration_use_case),
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
) -> JobResponse:
    """Resume execution of a paused or pending migration job."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    await repo.set_job_status(job_id, JobStatus.RUNNING)
    selected_ids = None
    if job.media_filter_rules and isinstance(job.media_filter_rules, dict):
        selected_ids = job.media_filter_rules.get("selected_message_ids")

    _dispatch_worker(
        job_id=job_id,
        use_case=use_case,
        repo=repo,
        broadcaster=broadcaster,
        selected_message_ids=selected_ids,
    )
    job.status = JobStatus.RUNNING
    return _to_job_response(job)


@router.post("/{job_id}/run-now", response_model=JobResponse)
async def run_scheduled_job_now(
    job_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
    use_case: CloneChannelVideosUseCase = Depends(get_migration_use_case),
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
) -> JobResponse:
    """Trigger a scheduled migration job immediately without waiting for its scheduled time."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    await repo.set_job_status(job_id, JobStatus.RUNNING)
    selected_ids = None
    if job.media_filter_rules and isinstance(job.media_filter_rules, dict):
        selected_ids = job.media_filter_rules.get("selected_message_ids")

    _dispatch_worker(
        job_id=job_id,
        use_case=use_case,
        repo=repo,
        broadcaster=broadcaster,
        selected_message_ids=selected_ids,
    )
    job.status = JobStatus.RUNNING
    return _to_job_response(job)


@router.post("/{job_id}/retry", response_model=dict[str, Any])
async def retry_failed_items(
    job_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
    use_case: CloneChannelVideosUseCase = Depends(get_migration_use_case),
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
) -> dict[str, Any]:
    """Requeue failed items for a job and resume processing."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    requeued = await repo.retry_failed_queue_items(job_id)
    if requeued > 0:
        await repo.set_job_status(job_id, JobStatus.RUNNING)
        _dispatch_worker(job_id, use_case, repo, broadcaster)
    return {
        "job_id": job_id,
        "requeued_items": requeued,
        "status": JobStatus.RUNNING.value if requeued > 0 else job.status.value,
    }


@router.delete("/{job_id}", response_model=dict[str, str])
async def delete_job(
    job_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
    use_case: CloneChannelVideosUseCase = Depends(get_migration_use_case),
) -> dict[str, str]:
    """Cancel and delete a migration job and its associated queue records."""
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    use_case.cancel_job(job_id)
    await repo.delete_job(job_id)
    return {"job_id": job_id, "deleted": "true"}


@router.post("/recovery/sweep", response_model=dict[str, Any])
async def run_recovery_sweep(
    clean_temp_files: bool = True,
    min_temp_age_seconds: int = 60,
    recovery_service: Any = Depends(get_crash_recovery_service),
) -> dict[str, Any]:
    """Execute manual orphan sweep and crash recovery across database jobs and temp files."""
    report = await recovery_service.run_recovery(
        clean_temp_files=clean_temp_files,
        min_temp_age_seconds=min_temp_age_seconds,
    )
    return report.to_dict()

