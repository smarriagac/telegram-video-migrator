from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.domain.entities.user import User
from backend.domain.entities.feed_source import FeedSource
from backend.presentation.dependencies import (
    get_current_user,
    get_job_repository,
    get_feed_watcher_service,
)
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.application.services.feed_watcher_service import FeedWatcherService

logger = logging.getLogger("telegram_migrator.feed_watcher_api")
router = APIRouter(prefix="/feeds", tags=["Auto-Pilot Feed Watcher"])


class CreateFeedSourceRequest(BaseModel):
    title: str
    source_url: str
    platform: str = "tiktok"  # "tiktok", "youtube", "instagram", "web"
    target_channel_id: int
    target_channel_title: str | None = None
    check_interval_minutes: int = 60
    pipeline_config: dict[str, Any] = {
        "aspect_ratio_mode": "9:16_BLUR",
        "burn_subtitles": True,
        "subtitle_style": "KINETIC_YELLOW",
        "slice_stories": True,
        "slice_dispatch_mode": "ALBUM",
        "generate_thumbnail": True,
        "mode": "RESERVOIR",
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_feed_source(
    payload: CreateFeedSourceRequest,
    current_user: User = Depends(get_current_user),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> dict[str, Any]:
    """Registers a new creator profile or playlist to be monitored in Auto-Pilot mode."""
    if not payload.source_url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source URL is required",
        )
    if not payload.target_channel_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target Telegram Channel is required",
        )

    tenant_id = getattr(current_user, "tenant_id", None) or "00000000-0000-0000-0000-000000000001"
    source = FeedSource(
        tenant_id=tenant_id,
        title=payload.title.strip() or "Monitored Feed",
        source_url=payload.source_url.strip(),
        platform=payload.platform.lower(),
        target_channel_id=payload.target_channel_id,
        target_channel_title=payload.target_channel_title,
        check_interval_minutes=max(5, payload.check_interval_minutes),
        pipeline_config=payload.pipeline_config,
    )
    created = await repo.create_feed_source(source)
    return {"success": True, "feed": created.to_dict()}


@router.get("")
async def list_feed_sources(
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> dict[str, Any]:
    """Lists all monitored feeds for the current tenant."""
    tenant_id = getattr(current_user, "tenant_id", None) or "00000000-0000-0000-0000-000000000001"
    sources = await repo.list_feed_sources(tenant_id=tenant_id, active_only=active_only)
    return {
        "success": True,
        "total": len(sources),
        "feeds": [s.to_dict() for s in sources],
    }


@router.get("/{feed_id}")
async def get_feed_source(
    feed_id: str,
    current_user: User = Depends(get_current_user),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> dict[str, Any]:
    """Gets details of an individual feed source."""
    source = await repo.get_feed_source(feed_id)
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")
    return {"success": True, "feed": source.to_dict()}


@router.post("/{feed_id}/check-now")
async def check_feed_source_now(
    feed_id: str,
    current_user: User = Depends(get_current_user),
    repo: JobRepositoryPort = Depends(get_job_repository),
    service: FeedWatcherService = Depends(get_feed_watcher_service),
) -> dict[str, Any]:
    """Triggers immediate poll of an external creator feed and ingests new videos."""
    source = await repo.get_feed_source(feed_id)
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")

    result = await service.poll_source(source, force=True)
    return {"success": True, "result": result}


@router.patch("/{feed_id}/toggle")
async def toggle_feed_source(
    feed_id: str,
    current_user: User = Depends(get_current_user),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> dict[str, Any]:
    """Toggles active monitoring on or off for a feed."""
    source = await repo.get_feed_source(feed_id)
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")

    source.is_active = not source.is_active
    updated = await repo.update_feed_source(source)
    return {"success": True, "is_active": updated.is_active, "feed": updated.to_dict()}


@router.delete("/{feed_id}")
async def delete_feed_source(
    feed_id: str,
    current_user: User = Depends(get_current_user),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> dict[str, Any]:
    """Deletes a feed source."""
    success = await repo.delete_feed_source(feed_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")
    return {"success": True, "deleted_id": feed_id}
