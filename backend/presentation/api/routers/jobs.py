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
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.presentation.dependencies import (
    get_broadcaster,
    get_job_repository,
    get_migration_use_case,
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


class JobResponse(BaseModel):
    job_id: str
    source_id: int
    target_id: int
    status: str
    total_videos: int
    processed_videos: int
    last_processed_id: int | None = None
    created_at: str | None = None
    is_full_migration: bool = True
    source_title: str | None = None
    target_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None


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
) -> JobResponse:
    """Create and start a new video migration job."""
    if req.source_channel_id == req.target_channel_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target channels must be different.",
        )

    job_id = str(uuid.uuid4())
    is_full = True if req.selected_message_ids is None or len(req.selected_message_ids) == 0 else False
    job = MigrationJob(
        job_id=job_id,
        source_id=req.source_channel_id,
        target_id=req.target_channel_id,
        status=JobStatus.PENDING,
        is_full_migration=is_full,
        source_title=req.source_channel_title,
        target_title=req.target_channel_title,
        source_account_id=req.source_account_id,
        target_account_id=req.target_account_id,
    )
    await repo.create_job(job)

    # Background task callback to broadcast events via SSE
    async def on_progress(event: dict[str, Any]):
        await broadcaster.publish(job_id, event)

    # Launch migration in background task
    async def run_worker():
        try:
            await use_case.execute(
                job_id=job_id,
                on_progress=on_progress,
                selected_message_ids=req.selected_message_ids,
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

    asyncio.create_task(run_worker())

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
    return {"job_id": job_id, "status": JobStatus.CANCELLED.value}
