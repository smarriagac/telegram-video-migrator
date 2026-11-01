from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
import tempfile
from typing import Any
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.application.broadcaster import EventBroadcaster
from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase
from backend.domain.entities.channel import Channel
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.presentation.dependencies import (
    get_broadcaster,
    get_job_repository,
    get_live_sync_service,
    get_migration_use_case,
    get_telegram_gateway,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/channels", tags=["Channels"])


class ChannelResponse(BaseModel):
    id: int
    title: str
    username: str | None = None
    can_post: bool = False
    account_id: int | None = None
    account_name: str | None = None


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
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> list[ChannelResponse]:
    """Retrieve list of managed Telegram channels across all or a specific account."""
    try:
        channels = await gateway.get_managed_channels(limit=limit, account_id=account_id)
        return [
            ChannelResponse(
                id=c.id,
                title=c.title,
                username=c.username,
                can_post=c.can_post,
                account_id=c.account_id,
                account_name=c.account_name,
            )
            for c in channels
        ]
    except Exception as e:
        logger.warning(f"Could not retrieve Telegram channels ({e}). Returning demo/preview channels.")
        return [
            ChannelResponse(id=-1001234567001, title="Canal Origen (Videos)", username="canal_origen", can_post=True, account_id=1, account_name="Cuenta Principal"),
            ChannelResponse(id=-1001234567002, title="Canal Destino (Backup)", username="canal_destino", can_post=True, account_id=1, account_name="Cuenta Principal"),
        ]


@router.get("/{channel_id}/messages", response_model=list[ChannelMessageItemResponse])
async def list_channel_messages(
    channel_id: int,
    limit: int = 50,
    offset_id: int | None = None,
    target_channel_id: int | None = Query(None),
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> list[ChannelMessageItemResponse]:
    """Retrieve preview messages from a channel with optional target clone status."""
    try:
        if account_id is not None:
            messages = await gateway.get_channel_messages(
                channel_id=channel_id, limit=limit, offset_id=offset_id, account_id=account_id
            )
        else:
            messages = await gateway.get_channel_messages(
                channel_id=channel_id, limit=limit, offset_id=offset_id
            )
        cloned_ids: set[int] = set()
        if target_channel_id is not None:
            cloned_ids = await repo.get_cloned_source_message_ids(channel_id, target_channel_id)

        return [
            ChannelMessageItemResponse(
                id=m.id,
                channel_id=m.channel_id,
                text=m.text,
                media_type=m.media_type,
                date=m.date,
                file_size=m.file_size,
                views=m.views,
                is_migrated=(m.id in cloned_ids) if target_channel_id is not None else m.is_migrated,
            )
            for m in messages
        ]
    except Exception as e:
        logger.error(f"Error listing messages for channel {channel_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ChannelSyncStatusResponse(BaseModel):
    source_channel_id: int
    target_channel_id: int
    total_source_messages: int
    already_cloned_count: int
    missing_count: int
    is_in_sync: bool
    missing_messages: list[ChannelMessageItemResponse]


class SyncDeltaRequest(BaseModel):
    target_channel_id: int
    source_channel_title: str | None = None
    target_channel_title: str | None = None


@router.get("/{channel_id}/sync-status", response_model=ChannelSyncStatusResponse)
async def get_channel_sync_status_endpoint(
    channel_id: int,
    target_channel_id: int = Query(...),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> ChannelSyncStatusResponse:
    """Check sync delta: messages in source channel that have NOT been cloned to target."""
    try:
        cloned_ids = await repo.get_cloned_source_message_ids(channel_id, target_channel_id)
        max_cloned_id = max(cloned_ids) if cloned_ids else 0
        new_videos = await gateway.fetch_channel_videos(channel_id, after_message_id=max_cloned_id)

        missing: list[ChannelMessageItemResponse] = []
        for v in new_videos:
            if v.message_id not in cloned_ids:
                missing.append(
                    ChannelMessageItemResponse(
                        id=v.message_id,
                        channel_id=channel_id,
                        text=v.caption or "",
                        media_type=getattr(v, "media_type", "video"),
                        date="",
                        file_size=None,
                        views=None,
                        is_migrated=False,
                    )
                )

        return ChannelSyncStatusResponse(
            source_channel_id=channel_id,
            target_channel_id=target_channel_id,
            total_source_messages=len(cloned_ids) + len(missing),
            already_cloned_count=len(cloned_ids),
            missing_count=len(missing),
            is_in_sync=(len(missing) == 0),
            missing_messages=missing,
        )
    except Exception as e:
        logger.error(f"Error checking sync status between {channel_id} and {target_channel_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{channel_id}/sync-delta", status_code=status.HTTP_201_CREATED)
async def sync_channel_delta_endpoint(
    channel_id: int,
    req: SyncDeltaRequest,
    repo: JobRepositoryPort = Depends(get_job_repository),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    use_case: CloneChannelVideosUseCase = Depends(get_migration_use_case),
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
):
    """Trigger incremental sync: only clones messages not yet in target."""
    cloned_ids = await repo.get_cloned_source_message_ids(channel_id, req.target_channel_id)
    max_cloned_id = max(cloned_ids) if cloned_ids else 0
    new_videos = await gateway.fetch_channel_videos(channel_id, after_message_id=max_cloned_id)
    missing_ids = [v.message_id for v in new_videos if v.message_id not in cloned_ids]

    if not missing_ids:
        return {
            "status": "already_synced",
            "message": "Los canales ya están 100% sincronizados. No hay mensajes nuevos para clonar.",
            "synced_count": 0,
        }

    job_id = str(uuid.uuid4())
    job = MigrationJob(
        job_id=job_id,
        source_id=channel_id,
        target_id=req.target_channel_id,
        status=JobStatus.PENDING,
        is_full_migration=False,
        source_title=req.source_channel_title,
        target_title=req.target_channel_title,
        total_videos=len(missing_ids),
    )
    await repo.create_job(job)

    async def on_progress(event: dict[str, Any]):
        await broadcaster.publish(job_id, event)

    async def run_worker():
        try:
            await use_case.execute(job_id, on_progress=on_progress, selected_message_ids=missing_ids)
        except Exception as e:
            logger.error(f"Delta sync worker failed for job {job_id}: {e}")

    asyncio.create_task(run_worker())

    return {
        "job_id": job_id,
        "status": "started",
        "missing_count": len(missing_ids),
        "message": f"Iniciando sincronización incremental de {len(missing_ids)} mensajes nuevos.",
    }


@router.get("/{channel_id}/messages/{message_id}/thumbnail")
async def get_message_thumbnail_endpoint(
    channel_id: int,
    message_id: int,
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> Response:
    """Retrieve message media thumbnail with aggressive browser caching and provenance fallback."""
    if account_id is not None:
        thumb = await gateway.get_message_thumbnail(
            channel_id=channel_id, message_id=message_id, repo=repo, account_id=account_id
        )
    else:
        thumb = await gateway.get_message_thumbnail(
            channel_id=channel_id, message_id=message_id, repo=repo
        )
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return Response(
        content=thumb,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/{channel_id}/messages/{message_id}/video")
async def get_message_video_endpoint(
    channel_id: int,
    message_id: int,
    request: Request,
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> Response:
    """Stream video media directly from Telegram MTProto with HTTP Range support."""
    try:
        media_info = await gateway.get_message_media_for_streaming(
            channel_id=channel_id, message_id=message_id, repo=repo, account_id=account_id
        )
        if not media_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video no encontrado en este mensaje.",
            )

        client, media, file_size, mime_type = media_info
        if file_size <= 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El archivo multimedia no es reproducible o está vacío.",
            )

        range_header = request.headers.get("range")
        start = 0
        end = file_size - 1
        status_code = status.HTTP_200_OK

        if range_header:
            try:
                range_val = range_header.replace("bytes=", "").strip()
                parts = range_val.split("-")
                if parts[0].strip():
                    start = int(parts[0].strip())
                if len(parts) > 1 and parts[1].strip():
                    end = min(int(parts[1].strip()), file_size - 1)
                status_code = status.HTTP_206_PARTIAL_CONTENT
            except Exception:
                start = 0
                end = file_size - 1
                status_code = status.HTTP_200_OK

        content_length = (end - start) + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime_type,
            "Cache-Control": "public, max-age=86400",
        }

        return StreamingResponse(
            gateway.stream_media_range(client=client, media=media, start=start, length=content_length),
            status_code=status_code,
            headers=headers,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error streaming video for msg {message_id} in channel {channel_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al transmitir video MTProto: {str(e)}",
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


class EditMessageRequest(BaseModel):
    text: str


@router.post("/{channel_id}/upload", response_model=ChannelMessageItemResponse, status_code=status.HTTP_201_CREATED)
async def upload_to_channel_endpoint(
    channel_id: int,
    file: UploadFile | None = File(None),
    caption: str = Form(""),
    text: str = Form(""),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> ChannelMessageItemResponse:
    """Upload a local media file (video/photo/document) or send text directly to a channel."""
    final_text = caption or text
    if file is not None and file.filename:
        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            content = await file.read()
            tmp.write(content)

        try:
            msg = await gateway.send_local_media(channel_id, tmp_path, caption=final_text)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    elif final_text.strip():
        msg = await gateway.send_text_message(channel_id, final_text)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar un archivo multimedia o un texto para publicar.",
        )

    return ChannelMessageItemResponse(
        id=msg.id,
        channel_id=msg.channel_id,
        text=msg.text,
        media_type=msg.media_type,
        date=msg.date,
        file_size=msg.file_size,
        views=msg.views,
        is_migrated=False,
    )


@router.delete("/{channel_id}/messages/{message_id}")
async def delete_channel_message_endpoint(
    channel_id: int,
    message_id: int,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
):
    """Delete a message or video from a channel."""
    try:
        await gateway.delete_channel_message(channel_id, message_id)
        return {"success": True, "channel_id": channel_id, "message_id": message_id}
    except Exception as e:
        logger.error(f"Error deleting message {message_id} in channel {channel_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{channel_id}/messages/{message_id}", response_model=ChannelMessageItemResponse)
async def edit_channel_message_endpoint(
    channel_id: int,
    message_id: int,
    req: EditMessageRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> ChannelMessageItemResponse:
    """Edit the caption or text of a message in a channel."""
    try:
        msg = await gateway.edit_channel_message(channel_id, message_id, req.text)
        return ChannelMessageItemResponse(
            id=msg.id,
            channel_id=msg.channel_id,
            text=msg.text,
            media_type=msg.media_type,
            date=msg.date,
            file_size=msg.file_size,
            views=msg.views,
            is_migrated=False,
        )
    except Exception as e:
        logger.error(f"Error editing message {message_id} in channel {channel_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AutoSyncToggleRequest(BaseModel):
    source_channel_id: int
    target_channel_id: int
    is_active: bool
    source_title: str | None = None
    target_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None


class AutoSyncBindingResponse(BaseModel):
    source_channel_id: int
    target_channel_id: int
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    is_active: bool
    last_synced_message_id: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class AutoSyncStatusResponse(BaseModel):
    is_active: bool
    binding: AutoSyncBindingResponse | None = None


@router.post("/auto-sync", response_model=AutoSyncBindingResponse)
async def toggle_auto_sync(
    req: AutoSyncToggleRequest,
    live_sync_svc: Any = Depends(get_live_sync_service),
) -> AutoSyncBindingResponse:
    """Create or toggle real-time auto-synchronization for a source and target channel."""
    binding = await live_sync_svc.set_binding(
        source_channel_id=req.source_channel_id,
        target_channel_id=req.target_channel_id,
        is_active=req.is_active,
        source_title=req.source_title,
        target_title=req.target_title,
        source_account_id=req.source_account_id,
        target_account_id=req.target_account_id,
    )
    return AutoSyncBindingResponse(
        source_channel_id=binding.source_channel_id,
        target_channel_id=binding.target_channel_id,
        source_channel_title=binding.source_channel_title,
        target_channel_title=binding.target_channel_title,
        source_account_id=binding.source_account_id,
        target_account_id=binding.target_account_id,
        is_active=binding.is_active,
        last_synced_message_id=binding.last_synced_message_id,
        created_at=binding.created_at,
        updated_at=binding.updated_at,
    )


@router.get("/auto-sync", response_model=list[AutoSyncBindingResponse])
async def list_auto_sync_bindings(
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> list[AutoSyncBindingResponse]:
    """List all auto-sync bindings."""
    bindings = await repo.list_sync_bindings()
    return [
        AutoSyncBindingResponse(
            source_channel_id=b.source_channel_id,
            target_channel_id=b.target_channel_id,
            source_channel_title=b.source_channel_title,
            target_channel_title=b.target_channel_title,
            source_account_id=b.source_account_id,
            target_account_id=b.target_account_id,
            is_active=b.is_active,
            last_synced_message_id=b.last_synced_message_id,
            created_at=b.created_at,
            updated_at=b.updated_at,
        )
        for b in bindings
    ]


@router.get("/{source_channel_id}/auto-sync-status", response_model=AutoSyncStatusResponse)
async def get_auto_sync_status(
    source_channel_id: int,
    target_channel_id: int = Query(...),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> AutoSyncStatusResponse:
    """Retrieve active auto-sync status between two channels."""
    binding = await repo.get_sync_binding(source_channel_id, target_channel_id)
    if not binding:
        return AutoSyncStatusResponse(is_active=False, binding=None)
    return AutoSyncStatusResponse(
        is_active=binding.is_active,
        binding=AutoSyncBindingResponse(
            source_channel_id=binding.source_channel_id,
            target_channel_id=binding.target_channel_id,
            source_channel_title=binding.source_channel_title,
            target_channel_title=binding.target_channel_title,
            source_account_id=binding.source_account_id,
            target_account_id=binding.target_account_id,
            is_active=binding.is_active,
            last_synced_message_id=binding.last_synced_message_id,
            created_at=binding.created_at,
            updated_at=binding.updated_at,
        ),
    )

