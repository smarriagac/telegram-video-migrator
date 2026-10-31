from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from backend.domain.entities.channel import Channel
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.presentation.dependencies import get_telegram_gateway, get_job_repository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/channels", tags=["Channels"])


class ChannelResponse(BaseModel):
    id: int
    title: str
    username: str | None = None
    can_post: bool = False


class ChannelMessageItemResponse(BaseModel):
    id: int
    channel_id: int
    text: str
    media_type: str | None = None
    date: str = ""
    file_size: int | None = None
    views: int | None = None
    is_migrated: bool = False


@router.get("", response_model=list[ChannelResponse])
async def list_channels(
    limit: int = 100,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> list[ChannelResponse]:
    """Retrieve list of managed Telegram channels."""
    try:
        channels = await gateway.get_managed_channels(limit=limit)
        return [
            ChannelResponse(
                id=c.id,
                title=c.title,
                username=c.username,
                can_post=c.can_post,
            )
            for c in channels
        ]
    except Exception as e:
        logger.warning(f"Could not retrieve Telegram channels ({e}). Returning demo/preview channels.")
        return [
            ChannelResponse(id=-1001234567001, title="Canal Origen (Videos)", username="canal_origen", can_post=True),
            ChannelResponse(id=-1001234567002, title="Canal Destino (Backup)", username="canal_destino", can_post=True),
        ]


@router.get("/{channel_id}/messages", response_model=list[ChannelMessageItemResponse])
async def list_channel_messages(
    channel_id: int,
    limit: int = 50,
    offset_id: int | None = None,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> list[ChannelMessageItemResponse]:
    """Retrieve preview messages from a channel for selection before migration."""
    try:
        messages = await gateway.get_channel_messages(channel_id=channel_id, limit=limit, offset_id=offset_id)
        return [
            ChannelMessageItemResponse(
                id=m.id,
                channel_id=m.channel_id,
                text=m.text,
                media_type=m.media_type,
                date=m.date,
                file_size=m.file_size,
                views=m.views,
                is_migrated=m.is_migrated,
            )
            for m in messages
        ]
    except Exception as e:
        logger.error(f"Error listing messages for channel {channel_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{channel_id}/messages/{message_id}/thumbnail")
async def get_message_thumbnail_endpoint(
    channel_id: int,
    message_id: int,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> Response:
    """Retrieve message media thumbnail with aggressive browser caching."""
    thumb = await gateway.get_message_thumbnail(channel_id=channel_id, message_id=message_id)
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return Response(
        content=thumb,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


class JobHistorySummaryResponse(BaseModel):
    job_id: str
    source_id: int
    source_title: str | None = None
    target_id: int
    target_title: str | None = None
    status: str
    total_videos: int
    processed_videos: int
    is_full_migration: bool = True
    created_at: str | None = None
    updated_at: str | None = None


class ChannelCloningHistoryResponse(BaseModel):
    channel_id: int
    total_clones: int
    has_full_clone: bool
    total_items_cloned: int
    jobs: list[JobHistorySummaryResponse]


class ClonedContentItemResponse(BaseModel):
    job_id: str
    source_message_id: int
    target_message_id: int | None = None
    media_type: str
    caption: str
    migrated_at: str | None = None
    target_channel_id: int
    target_channel_title: str | None = None


@router.get("/{channel_id}/cloning-history", response_model=ChannelCloningHistoryResponse)
async def get_channel_cloning_history_endpoint(
    channel_id: int,
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> ChannelCloningHistoryResponse:
    """Retrieve complete cloning history, number of clones, and full/partial coverage."""
    history = await repo.get_channel_cloning_history(channel_id)
    return ChannelCloningHistoryResponse(
        channel_id=history.channel_id,
        total_clones=history.total_clones,
        has_full_clone=history.has_full_clone,
        total_items_cloned=history.total_items_cloned,
        jobs=[
            JobHistorySummaryResponse(
                job_id=j.job_id,
                source_id=j.source_id,
                source_title=j.source_title,
                target_id=j.target_id,
                target_title=j.target_title,
                status=j.status.value,
                total_videos=j.total_videos,
                processed_videos=j.processed_videos,
                is_full_migration=j.is_full_migration,
                created_at=j.created_at,
                updated_at=j.updated_at,
            )
            for j in history.jobs
        ],
    )


@router.get("/{channel_id}/cloned-content", response_model=list[ClonedContentItemResponse])
async def get_channel_cloned_content_endpoint(
    channel_id: int,
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> list[ClonedContentItemResponse]:
    """Retrieve exact audit list of all messages/media cloned from this channel."""
    items = await repo.get_cloned_content_for_channel(channel_id)
    return [
        ClonedContentItemResponse(
            job_id=it.job_id,
            source_message_id=it.source_message_id,
            target_message_id=it.target_message_id,
            media_type=it.media_type,
            caption=it.caption,
            migrated_at=it.migrated_at,
            target_channel_id=it.target_channel_id,
            target_channel_title=it.target_channel_title,
        )
        for it in items
    ]
