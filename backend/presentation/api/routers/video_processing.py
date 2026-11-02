from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.domain.entities.user import User
from backend.presentation.dependencies import get_current_user, get_video_processing_service

logger = logging.getLogger("telegram_migrator.video_processing_api")
router = APIRouter(prefix="/video-processing", tags=["Video Processing (FFmpeg)"])


class EnqueueVideoJobRequest(BaseModel):
    source_channel_id: int
    source_message_id: int
    target_channel_id: int
    filter_type: str = "delogo"
    filter_params: dict[str, Any] = {"preset": "center"}
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    account_id: int | None = None
    new_caption: str | None = None


@router.post("/enqueue")
async def enqueue_video_processing(
    payload: EnqueueVideoJobRequest,
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Enqueue a video from a channel for asynchronous FFmpeg watermark removal / delogo processing."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    try:
        res = await service.enqueue_job(
            tenant_id=tenant_id,
            source_channel_id=payload.source_channel_id,
            source_message_id=payload.source_message_id,
            target_channel_id=payload.target_channel_id,
            filter_type=payload.filter_type,
            filter_params=payload.filter_params,
            source_channel_title=payload.source_channel_title,
            target_channel_title=payload.target_channel_title,
            account_id=payload.account_id,
            new_caption=payload.new_caption,
        )
        return {"success": True, "job": res}
    except Exception as ex:
        logger.error(f"Failed to enqueue video processing job: {ex}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al encolar trabajo de procesamiento FFmpeg: {ex}",
        )


@router.get("/jobs")
async def list_video_processing_jobs(
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> list[dict[str, Any]]:
    """List recent and active FFmpeg video processing queue jobs."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    try:
        return await service.list_jobs(tenant_id=tenant_id, limit=50)
    except Exception as ex:
        logger.error(f"Failed to list video processing jobs: {ex}", exc_info=True)
        return []


@router.post("/jobs/{job_id}/cancel")
async def cancel_video_processing_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Cancel a pending or running FFmpeg job."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    ok = await service.cancel_job(tenant_id=tenant_id, job_id=job_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo no encontrado o ya finalizado.",
        )
    return {"success": True, "message": "Trabajo cancelado con éxito."}


@router.delete("/jobs/{job_id}")
async def delete_video_processing_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Delete a completed or failed FFmpeg job record."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    ok = await service.delete_job(tenant_id=tenant_id, job_id=job_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro no encontrado.",
        )
    return {"success": True, "message": "Registro eliminado."}
