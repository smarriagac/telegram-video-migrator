from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl

from backend.domain.entities.user import User
from backend.presentation.dependencies import (
    get_current_user,
    get_media_ingestion_service,
)
from backend.application.services.media_ingestion_service import MediaIngestionService

logger = logging.getLogger("telegram_migrator.ingestion_api")
router = APIRouter(prefix="/ingestion", tags=["Multi-Platform Media Ingestion"])


class InspectUrlRequest(BaseModel):
    url: str


class StageIngestionRequest(BaseModel):
    url: str
    target_channel_id: int
    mode: str = "DIRECT"  # "DIRECT" or "RESERVOIR"
    caption_override: str | None = None
    aspect_ratio_mode: str | None = "ORIGINAL"  # "ORIGINAL", "9:16_BLUR", "9:16_CROP"
    branding_text: str | None = None
    account_id: int | None = None
    campaign_id: str | None = None
    slice_stories: bool = False
    slice_dispatch_mode: str = "ALBUM"  # "ALBUM" or "SEQUENTIAL"
    max_slice_seconds: float = 60.0
    burn_subtitles: bool = False
    subtitle_style: str = "KINETIC_YELLOW"  # "KINETIC_YELLOW", "CLASSIC_WHITE", "BOXED_BLACK"


@router.post("/inspect")
async def inspect_remote_url(
    payload: InspectUrlRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Inspects a video URL from TikTok, Instagram, YouTube Shorts, etc. and returns metadata."""
    if not payload.url or not payload.url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL is required",
        )

    meta = MediaIngestionService.inspect_url(payload.url.strip())
    if not meta.get("success"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=meta.get("error", "Failed to extract metadata from video URL"),
        )
    return meta


@router.post("/stage")
async def stage_ingestion(
    payload: StageIngestionRequest,
    current_user: User = Depends(get_current_user),
    service: MediaIngestionService = Depends(get_media_ingestion_service),
) -> dict[str, Any]:
    """Downloads remote media, applies optional 9:16 formatting, and publishes to Telegram."""
    try:
        tenant_id = getattr(current_user, "tenant_id", "default")
        result = await service.ingest(
            tenant_id=tenant_id,
            url=payload.url.strip(),
            target_channel_id=payload.target_channel_id,
            mode=payload.mode,
            caption_override=payload.caption_override,
            aspect_ratio_mode=payload.aspect_ratio_mode,
            branding_text=payload.branding_text,
            account_id=payload.account_id,
            campaign_id=payload.campaign_id,
            slice_stories=payload.slice_stories,
            slice_dispatch_mode=payload.slice_dispatch_mode,
            max_slice_seconds=payload.max_slice_seconds,
            burn_subtitles=payload.burn_subtitles,
            subtitle_style=payload.subtitle_style,
        )
        return result
    except Exception as e:
        logger.error(f"Media ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {str(e)}",
        )
