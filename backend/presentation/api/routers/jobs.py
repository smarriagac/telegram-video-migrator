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


class JobResponse(BaseModel):
    job_id: str
    source_id: int
    target_id: int
    status: str
    total_videos: int
    processed_videos: int
    last_processed_id: int | None = None
    created_at: str | None = None


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
    job = MigrationJob(
        job_id=job_id,
        source_id=req.source_channel_id,
        target_id=req.target_channel_id,
        status=JobStatus.PENDING,
    )
    await repo.create_job(job)

    # Background task callback to broadcast events via SSE
    async def on_progress(event: dict[str, Any]):
        await broadcaster.publish(job_id, event)

    # Launch migration in background task
    async def run_worker():
        try:
            await use_case.execute(job_id=job_id, on_progress=on_progress)
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
