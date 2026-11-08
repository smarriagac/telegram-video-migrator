from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.domain.entities.drip_campaign import (
    CampaignStatus,
    DripCampaign,
    ReservoirItem,
    ReservoirItemStatus,
)
from backend.presentation.dependencies import (
    get_drip_campaign_service,
    get_job_repository,
)
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.application.services.drip_campaign_service import DripCampaignService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reservoir", tags=["Content Reservoir & Drip Campaigns"])


class CreateCampaignRequest(BaseModel):
    title: str
    source_channel_id: int
    target_channel_id: int
    source_message_ids: list[int] = Field(default_factory=list)
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    interval_minutes: int = 60
    batch_size: int = 1
    jitter_seconds: int = 0
    daily_window_start: str | None = None
    daily_window_end: str | None = None
    caption_rules: dict[str, Any] | None = None


class EditItemCaptionRequest(BaseModel):
    caption: str


@router.post("/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CreateCampaignRequest,
    drip_service: DripCampaignService = Depends(get_drip_campaign_service),
) -> dict[str, Any]:
    if not payload.source_message_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere al menos un ID de mensaje para encolar en el reservorio.",
        )

    campaign = await drip_service.create_campaign(
        title=payload.title,
        source_channel_id=payload.source_channel_id,
        target_channel_id=payload.target_channel_id,
        source_message_ids=payload.source_message_ids,
        source_channel_title=payload.source_channel_title,
        target_channel_title=payload.target_channel_title,
        source_account_id=payload.source_account_id,
        target_account_id=payload.target_account_id,
        interval_minutes=payload.interval_minutes,
        batch_size=payload.batch_size,
        jitter_seconds=payload.jitter_seconds,
        daily_window_start=payload.daily_window_start,
        daily_window_end=payload.daily_window_end,
        caption_rules=payload.caption_rules,
    )
    return {"message": "Campaña creada exitosamente", "campaign": campaign}


@router.get("/campaigns")
async def list_campaigns(
    status_filter: str | None = Query(None, alias="status"),
    job_repo: JobRepositoryPort = Depends(get_job_repository),
) -> list[DripCampaign]:
    return await job_repo.list_drip_campaigns(status=status_filter)


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    job_repo: JobRepositoryPort = Depends(get_job_repository),
) -> DripCampaign:
    camp = await job_repo.get_drip_campaign(campaign_id)
    if not camp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaña '{campaign_id}' no encontrada",
        )
    return camp


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: str,
    drip_service: DripCampaignService = Depends(get_drip_campaign_service),
) -> dict[str, Any]:
    success = await drip_service.pause_campaign(campaign_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaña '{campaign_id}' no encontrada",
        )
    return {"message": f"Campaña '{campaign_id}' pausada"}


@router.post("/campaigns/{campaign_id}/resume")
async def resume_campaign(
    campaign_id: str,
    drip_service: DripCampaignService = Depends(get_drip_campaign_service),
) -> dict[str, Any]:
    success = await drip_service.resume_campaign(campaign_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaña '{campaign_id}' no encontrada",
        )
    return {"message": f"Campaña '{campaign_id}' reactivada"}


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    job_repo: JobRepositoryPort = Depends(get_job_repository),
) -> dict[str, Any]:
    success = await job_repo.delete_drip_campaign(campaign_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaña '{campaign_id}' no encontrada",
        )
    return {"message": f"Campaña '{campaign_id}' eliminada exitosamente"}


@router.get("/campaigns/{campaign_id}/items")
async def list_campaign_items(
    campaign_id: str,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    job_repo: JobRepositoryPort = Depends(get_job_repository),
) -> dict[str, Any]:
    items, total = await job_repo.list_reservoir_items(
        campaign_id=campaign_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return {
        "campaign_id": campaign_id,
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/items/{item_id}/release-now")
async def release_item_now(
    item_id: str,
    drip_service: DripCampaignService = Depends(get_drip_campaign_service),
) -> dict[str, Any]:
    success, item = await drip_service.release_item_now(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Elemento '{item_id}' no encontrado en el reservorio",
        )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fallo al publicar el elemento: {item.error_message}",
        )
    return {"message": "Elemento publicado inmediatamente con éxito", "item": item}


@router.patch("/items/{item_id}")
async def update_item_caption(
    item_id: str,
    payload: EditItemCaptionRequest,
    drip_service: DripCampaignService = Depends(get_drip_campaign_service),
) -> dict[str, Any]:
    item = await drip_service.update_item_caption(item_id, payload.caption)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Elemento '{item_id}' no encontrado",
        )
    return {"message": "Caption actualizado exitosamente", "item": item}


@router.post("/items/{item_id}/skip")
async def skip_item(
    item_id: str,
    drip_service: DripCampaignService = Depends(get_drip_campaign_service),
) -> dict[str, Any]:
    success = await drip_service.skip_item(item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Elemento '{item_id}' no encontrado",
        )
    return {"message": f"Elemento '{item_id}' omitido"}
