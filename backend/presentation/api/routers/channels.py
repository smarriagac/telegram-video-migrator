from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
import json
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
from backend.domain.entities.audit_log import AuditLog
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.presentation.dependencies import (
    get_broadcaster,
    get_job_repository,
    get_audit_repository,
    get_live_sync_service,
    get_migration_use_case,
    get_telegram_gateway,
    get_postgres_repository,
    get_current_user,
)
from backend.domain.entities.user import User
from backend.domain.entities.channel_membership import ChannelMembership, MembershipStatus
from backend.application.services.membership_gatekeeper_service import MembershipGatekeeperService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/channels", tags=["Channels"])


class ChannelResponse(BaseModel):
    id: int
    title: str
    username: str | None = None
    can_post: bool = False
    account_id: int | None = None
    account_name: str | None = None
    type: str = "channel"


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
    admin_only: bool = Query(False),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> list[ChannelResponse]:
    """Retrieve list of managed Telegram channels across all or a specific account."""
    try:
        channels = await gateway.get_managed_channels(limit=limit, account_id=account_id)
        if admin_only:
            channels = [c for c in channels if c.can_post]
        return [
            ChannelResponse(
                id=c.id,
                title=c.title,
                username=c.username,
                can_post=c.can_post,
                account_id=c.account_id,
                account_name=c.account_name,
                type=getattr(c, "type", "channel"),
            )
            for c in channels
        ]
    except Exception as e:
        logger.warning(f"Could not retrieve Telegram channels ({e}). Returning demo/preview channels.")
        return [
            ChannelResponse(id=-1001234567001, title="Canal Origen (Videos)", username="canal_origen", can_post=True, account_id=1, account_name="Cuenta Principal", type="channel"),
            ChannelResponse(id=-1001234567002, title="Canal Destino (Backup)", username="canal_destino", can_post=True, account_id=1, account_name="Cuenta Principal", type="channel"),
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


class BatchEditCaptionRequest(BaseModel):
    message_ids: list[int]
    text: str
    mode: str = "append"  # "append" | "prepend" | "replace"
    account_id: int | None = None


class BatchEditCaptionResponse(BaseModel):
    status: str
    channel_id: int
    updated_count: int
    message_ids: list[int]
    mode: str


class PublishAlbumRequest(BaseModel):
    target_channel_id: int
    message_ids: list[int]
    caption: str = ""
    account_id: int | None = None
    target_account_id: int | None = None
    scheduled_at: datetime | None = None
    delete_source_messages: bool = False


class PublishAlbumResponse(BaseModel):
    status: str
    source_channel_id: int
    target_channel_id: int
    sent_message_ids: list[int]
    caption: str
    is_scheduled: bool
    deleted_source_count: int = 0


@router.post("/{channel_id}/messages/batch-edit-caption", response_model=BatchEditCaptionResponse)
async def batch_edit_caption_endpoint(
    channel_id: int,
    req: BatchEditCaptionRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> BatchEditCaptionResponse:
    """Batch edit captions or tags on existing messages in a channel without re-sending."""
    if not req.message_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe seleccionar al menos un mensaje para editar.",
        )
    if not req.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El texto o etiqueta a aplicar no puede estar vacío.",
        )

    tag_text = req.text.strip()
    updated_ids: list[int] = []

    # Attempt to fetch existing messages to preserve caption when appending/prepending
    existing_messages_map: dict[int, str] = {}
    try:
        if hasattr(gateway, "get_messages_by_ids"):
            existing_msgs = await gateway.get_messages_by_ids(
                channel_id=channel_id,
                message_ids=req.message_ids,
                account_id=req.account_id,
            )
            for em in existing_msgs:
                existing_messages_map[em.id] = em.text or ""
    except Exception as e:
        logger.warning(f"Could not batch fetch messages for caption edit: {e}")

    for msg_id in req.message_ids:
        current_text = existing_messages_map.get(msg_id, "")
        if req.mode == "append":
            new_text = f"{current_text} {tag_text}".strip() if current_text else tag_text
        elif req.mode == "prepend":
            new_text = f"{tag_text} {current_text}".strip() if current_text else tag_text
        else:  # replace
            new_text = tag_text

        try:
            await gateway.edit_channel_message(
                channel_id=channel_id,
                message_id=msg_id,
                text=new_text,
            )
            updated_ids.append(msg_id)
        except Exception as edit_err:
            logger.warning(f"Failed to edit message #{msg_id} in channel {channel_id}: {edit_err}")

    try:
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=None,
                user_email=None,
                action="BATCH_CAPTION_EDIT",
                resource=f"channel:{channel_id}",
                details={
                    "channel_id": channel_id,
                    "updated_count": len(updated_ids),
                    "message_ids": updated_ids,
                    "mode": req.mode,
                    "tag_text": tag_text,
                },
            )
        )
    except Exception as audit_err:
        logger.warning(f"Could not record audit log for batch caption edit: {audit_err}")

    return BatchEditCaptionResponse(
        status="success",
        channel_id=channel_id,
        updated_count=len(updated_ids),
        message_ids=updated_ids,
        mode=req.mode,
    )


@router.post("/{channel_id}/publish-album", response_model=PublishAlbumResponse, status_code=status.HTTP_201_CREATED)
async def publish_album_endpoint(
    channel_id: int,
    req: PublishAlbumRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> PublishAlbumResponse:
    """Group 2 to 10 media messages from source channel and publish them as an album (MediaGroup) in target channel or same channel."""
    if not req.message_ids or len(req.message_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los álbumes de Telegram requieren al menos 2 elementos multimedia.",
        )
    if len(req.message_ids) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los álbumes de Telegram soportan un máximo de 10 elementos multimedia por grupo.",
        )

    try:
        sent_ids = await gateway.send_media_album(
            target_channel_id=req.target_channel_id,
            source_channel_id=channel_id,
            message_ids=req.message_ids,
            caption=req.caption,
            account_id=req.account_id,
            schedule_date=req.scheduled_at,
        )

        deleted_count = 0
        if req.delete_source_messages:
            try:
                if hasattr(gateway, "delete_channel_messages"):
                    await gateway.delete_channel_messages(
                        channel_id=channel_id,
                        message_ids=req.message_ids,
                        account_id=req.account_id,
                    )
                    deleted_count = len(req.message_ids)
                else:
                    for mid in req.message_ids:
                        await gateway.delete_channel_message(channel_id, mid)
                        deleted_count += 1
            except Exception as del_err:
                logger.warning(f"Failed to delete original loose messages after album publication: {del_err}")

        try:
            await audit_repo.record_audit_log(
                AuditLog(
                    id=None,
                    user_id=None,
                    user_email=None,
                    action="ALBUM_PUBLISHED",
                    resource=f"channel:{req.target_channel_id}",
                    details={
                        "source_channel_id": channel_id,
                        "target_channel_id": req.target_channel_id,
                        "source_message_ids": req.message_ids,
                        "sent_message_ids": sent_ids,
                        "caption": req.caption,
                        "is_scheduled": bool(req.scheduled_at),
                        "scheduled_at": req.scheduled_at.isoformat() if req.scheduled_at else None,
                        "deleted_source_messages": req.delete_source_messages,
                        "deleted_count": deleted_count,
                    },
                )
            )
        except Exception as audit_err:
            logger.warning(f"Could not record audit log for album publish: {audit_err}")

        return PublishAlbumResponse(
            status="success",
            source_channel_id=channel_id,
            target_channel_id=req.target_channel_id,
            sent_message_ids=sent_ids,
            caption=req.caption,
            is_scheduled=bool(req.scheduled_at),
            deleted_source_count=deleted_count,
        )
    except FloodWaitDomainException as fw:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Telegram rate limit: espere {fw.seconds} segundos.",
        )
    except ChannelAccessDeniedException as cad:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permiso denegado en el canal: {cad}",
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as e:
        logger.error(f"Error publishing album from #{channel_id} to #{req.target_channel_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al publicar el álbum en Telegram: {e}",
        )


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
    caption_rules: dict | None = None
    media_filter_rules: dict | None = None


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
    caption_rules: dict | None = None
    media_filter_rules: dict | None = None


class AutoSyncStatusResponse(BaseModel):
    is_active: bool
    binding: AutoSyncBindingResponse | None = None


@router.post("/auto-sync", response_model=AutoSyncBindingResponse)
async def toggle_auto_sync(
    req: AutoSyncToggleRequest,
    live_sync_svc: Any = Depends(get_live_sync_service),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
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
        caption_rules=req.caption_rules,
        media_filter_rules=req.media_filter_rules,
    )
    try:
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=None,
                user_email=None,
                action="AUTO_SYNC_TOGGLE",
                resource=f"channel:{req.source_channel_id}->{req.target_channel_id}",
                details={
                    "is_active": req.is_active,
                    "source_title": req.source_title,
                    "target_title": req.target_title,
                    "caption_rules": req.caption_rules,
                    "media_filter_rules": req.media_filter_rules,
                },
            )
        )
    except Exception as e:
        logger.warning(f"Could not record audit log for auto-sync: {e}")

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
        caption_rules=binding.caption_rules,
        media_filter_rules=binding.media_filter_rules,
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
            caption_rules=b.caption_rules,
            media_filter_rules=b.media_filter_rules,
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
            caption_rules=binding.caption_rules,
            media_filter_rules=binding.media_filter_rules,
        ),
    )


class CreateVipInviteRequest(BaseModel):
    channel_id: int
    duration_days: int = 30
    account_id: int | None = None
    telegram_username: str | None = None
    auto_send_dm: bool = True


class ChannelMembershipResponse(BaseModel):
    id: str
    tenant_id: str
    channel_id: int
    telegram_user_id: int | None = None
    telegram_username: str | None = None
    invite_link: str | None = None
    status: str
    joined_at: str | None = None
    expires_at: str
    created_at: str | None = None
    kick_reason: str | None = None
    dm_sent: bool = False
    dm_error: str | None = None


class JoinRequestResponse(BaseModel):
    channel_id: int
    user_id: int
    date: str | None = None
    first_name: str = ""
    last_name: str = ""
    username: str | None = None
    about: str | None = None


class ApproveJoinRequestPayload(BaseModel):
    channel_id: int
    user_id: int
    duration_days: int = 30
    username: str | None = None


class RejectJoinRequestPayload(BaseModel):
    channel_id: int
    user_id: int


class KickMemberPayload(BaseModel):
    channel_id: int
    user_id: int
    membership_id: str | None = None
    reason: str = "Incumplimiento de normas"


class KickBatchMembersItem(BaseModel):
    membership_id: str | None = None
    user_id: int
    channel_id: int


class KickBatchMembersPayload(BaseModel):
    items: list[KickBatchMembersItem]
    reason: str = "Expulsión en lote por administrador"
    account_id: int | None = None


class AddMemberPayload(BaseModel):
    channel_id: int
    user_id_or_username: str
    duration_days: int = 30
    direct_invite: bool = False
    auto_send_dm: bool = True
    account_id: int | None = None


class PaymentWebhookPayload(BaseModel):
    channel_id: int
    user_id_or_username: str
    duration_days: int = 30
    amount: float | None = None
    currency: str = "USD"
    payment_provider: str = "STRIPE"
    payment_id: str | None = None
    auto_send_dm: bool = True
    account_id: int | None = None
    secret_token: str | None = None


@router.post("/gatekeeper/invite", response_model=ChannelMembershipResponse)
async def create_vip_invite_pass(
    req: CreateVipInviteRequest,
    current_user: User = Depends(get_current_user),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    pg_repo: Any = Depends(get_postgres_repository),
) -> ChannelMembershipResponse:
    """Generate a single-use time-bounded VIP invite link for a channel."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    gatekeeper = MembershipGatekeeperService(gateway)

    membership = await gatekeeper.generate_pass(
        tenant_id=tenant_id,
        channel_id=req.channel_id,
        duration_days=req.duration_days,
        account_id=req.account_id,
        request_needed=True,
        title=f"VIP - {req.telegram_username or 'Pass'}",
    )
    membership.telegram_username = req.telegram_username

    dm_sent = False
    dm_error = None
    if req.auto_send_dm and req.telegram_username and membership.invite_link:
        target_user = req.telegram_username.strip()
        dm_text = (
            f"👋 ¡Hola! Te compartimos tu pase de acceso VIP exclusivo:\n\n"
            f"🔗 Enlace de ingreso (válido para 1 uso):\n{membership.invite_link}\n\n"
            f"⏳ Validez: {req.duration_days} días.\n"
            f"¡Bienvenido a la comunidad!"
        )
        try:
            dm_sent = await gateway.send_direct_message(
                recipient=target_user,
                text=dm_text,
                account_id=req.account_id,
            )
            if not dm_sent:
                dm_error = "No se pudo entregar el mensaje directo (revisar configuración de privacidad o si el usuario existe)."
        except Exception as ex:
            logger.warning(f"Error auto-sending VIP invite DM to {target_user}: {ex}")
            dm_sent = False
            dm_error = str(ex)

    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO channel_memberships (
                        id, tenant_id, channel_id, telegram_user_id, telegram_username,
                        invite_link, status, expires_at, created_at, updated_at
                    )
                    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::timestamptz, NOW(), NOW())
                    """,
                    membership.id,
                    tenant_id,
                    membership.channel_id,
                    membership.telegram_user_id,
                    membership.telegram_username,
                    membership.invite_link,
                    membership.status.value,
                    membership.expires_at,
                )
    except Exception as ex:
        logger.warning(f"Failed to persist membership in postgres: {ex}")

    return ChannelMembershipResponse(
        id=membership.id,
        tenant_id=membership.tenant_id,
        channel_id=membership.channel_id,
        telegram_user_id=membership.telegram_user_id,
        telegram_username=membership.telegram_username,
        invite_link=membership.invite_link,
        status=membership.status.value,
        expires_at=membership.expires_at,
        created_at=membership.created_at,
        dm_sent=dm_sent,
        dm_error=dm_error,
    )


@router.get("/gatekeeper/members", response_model=list[ChannelMembershipResponse])
async def list_channel_memberships(
    channel_id: int | None = None,
    user_id: int | None = None,
    username: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    pg_repo: Any = Depends(get_postgres_repository),
) -> list[ChannelMembershipResponse]:
    """List tracked VIP channel memberships for the active tenant, optionally filtered by channel, user or status."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                query = """
                    SELECT id, tenant_id, channel_id, telegram_user_id, telegram_username,
                           invite_link, status, joined_at, expires_at, created_at, kick_reason
                    FROM channel_memberships
                    WHERE tenant_id = $1::uuid
                """
                params: list[Any] = [tenant_id]
                idx = 2
                if channel_id is not None:
                    query += f" AND channel_id = ${idx}"
                    params.append(channel_id)
                    idx += 1
                if user_id is not None:
                    query += f" AND telegram_user_id = ${idx}"
                    params.append(user_id)
                    idx += 1
                if username is not None:
                    clean_u = username.lstrip("@").lower()
                    query += f" AND (telegram_username IS NOT NULL AND LOWER(TRIM(LEADING '@' FROM telegram_username)) = ${idx})"
                    params.append(clean_u)
                    idx += 1
                if status is not None:
                    query += f" AND status = ${idx}"
                    params.append(status)
                    idx += 1
                query += " ORDER BY created_at DESC LIMIT 300"

                rows = await conn.fetch(query, *params)
                return [
                    ChannelMembershipResponse(
                        id=str(r["id"]),
                        tenant_id=str(r["tenant_id"]),
                        channel_id=r["channel_id"],
                        telegram_user_id=r["telegram_user_id"],
                        telegram_username=r["telegram_username"],
                        invite_link=r["invite_link"],
                        status=r["status"],
                        joined_at=str(r["joined_at"]) if r["joined_at"] else None,
                        expires_at=str(r["expires_at"]),
                        created_at=str(r["created_at"]) if r["created_at"] else None,
                        kick_reason=r.get("kick_reason") if "kick_reason" in r else None,
                    )
                    for r in rows
                ]
    except Exception as ex:
        logger.warning(f"Failed to fetch memberships from postgres: {ex}")

    return []


@router.get("/gatekeeper/requests", response_model=list[JoinRequestResponse])
async def list_join_requests(
    channel_id: int | None = None,
    current_user: User = Depends(get_current_user),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> list[JoinRequestResponse]:
    """Fetch pending join requests for owned channels requiring admin approval."""
    target_channels: list[int] = []
    if channel_id:
        target_channels.append(channel_id)
    else:
        channels = await gateway.get_managed_channels(limit=50)
        for c in channels:
            if c.can_post:
                target_channels.append(c.id)

    results: list[JoinRequestResponse] = []
    for cid in target_channels:
        reqs = await gateway.get_join_requests(cid)
        for r in reqs:
            results.append(JoinRequestResponse(**r))
    return results


@router.post("/gatekeeper/requests/approve")
async def approve_join_request(
    payload: ApproveJoinRequestPayload,
    current_user: User = Depends(get_current_user),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    pg_repo: Any = Depends(get_postgres_repository),
) -> dict:
    """Approve a pending join request, activate membership, and record joined_at timestamp."""
    success = await gateway.hide_join_request(
        channel_id=payload.channel_id,
        user_id=payload.user_id,
        approved=True,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al aprobar la solicitud en Telegram MTProto.",
        )

    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=payload.duration_days)

    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                clean_username = payload.username.lstrip("@").lower() if payload.username else None
                pending_row = await conn.fetchrow(
                    """
                    SELECT id, invite_link
                    FROM channel_memberships
                    WHERE tenant_id = $1::uuid
                      AND channel_id = $2
                      AND (
                          telegram_user_id = $3
                          OR (telegram_username IS NOT NULL AND LOWER(TRIM(LEADING '@' FROM telegram_username)) = $4)
                          OR status = 'INVITED'
                      )
                    ORDER BY (status = 'INVITED') DESC, created_at DESC
                    LIMIT 1
                    """,
                    tenant_id,
                    payload.channel_id,
                    payload.user_id,
                    clean_username,
                )

                if pending_row:
                    await conn.execute(
                        """
                        UPDATE channel_memberships
                        SET telegram_user_id = $1,
                            telegram_username = COALESCE($2, telegram_username),
                            status = 'ACTIVE',
                            joined_at = $3,
                            expires_at = $4,
                            updated_at = $3
                        WHERE id = $5
                        """,
                        payload.user_id,
                        payload.username,
                        now,
                        expires_at,
                        pending_row["id"],
                    )
                else:
                    last_link = await conn.fetchval(
                        """
                        SELECT invite_link FROM channel_memberships
                        WHERE tenant_id = $1::uuid AND channel_id = $2 AND invite_link IS NOT NULL AND invite_link != ''
                        ORDER BY created_at DESC LIMIT 1
                        """,
                        tenant_id,
                        payload.channel_id,
                    )
                    if not last_link:
                        try:
                            last_link = await gateway.create_channel_invite_link(
                                channel_id=payload.channel_id,
                                request_needed=True,
                                title=f"VIP - {payload.username or payload.user_id}",
                                account_id=payload.account_id,
                            )
                        except Exception as link_err:
                            logger.warning(
                                f"Could not auto-generate fallback invite link for channel {payload.channel_id}: {link_err}"
                            )
                    await conn.execute(
                        """
                        INSERT INTO channel_memberships (
                            id, tenant_id, channel_id, telegram_user_id, telegram_username,
                            invite_link, status, joined_at, expires_at, created_at, updated_at
                        )
                        VALUES (
                            gen_random_uuid(), $1::uuid, $2, $3, $4,
                            $5, 'ACTIVE', $6, $7, $6, $6
                        )
                        """,
                        tenant_id,
                        payload.channel_id,
                        payload.user_id,
                        payload.username,
                        last_link,
                        now,
                        expires_at,
                    )
    except Exception as ex:
        logger.warning(f"Error persisting approved membership: {ex}")

    return {
        "success": True,
        "channel_id": payload.channel_id,
        "user_id": payload.user_id,
        "joined_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "ACTIVE",
    }


@router.post("/gatekeeper/requests/reject")
async def reject_join_request(
    payload: RejectJoinRequestPayload,
    current_user: User = Depends(get_current_user),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict:
    """Reject/dismiss a pending join request."""
    success = await gateway.hide_join_request(
        channel_id=payload.channel_id,
        user_id=payload.user_id,
        approved=False,
    )
    return {"success": success, "channel_id": payload.channel_id, "user_id": payload.user_id}


@router.post("/gatekeeper/add_member")
async def add_or_invite_member(
    payload: AddMemberPayload,
    current_user: User = Depends(get_current_user),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    pg_repo: Any = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Add a member directly to a channel/group or generate and send a VIP access pass via direct message."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    now = datetime.now(timezone.utc)
    target = payload.user_id_or_username.strip()
    direct_added = False
    invite_link = None
    dm_sent = False
    error_detail = None

    if payload.direct_invite:
        try:
            direct_added = await gateway.invite_user_to_channel(
                channel_id=payload.channel_id,
                user_id_or_username=target,
                account_id=payload.account_id,
            )
        except Exception as ex:
            error_msg = str(ex)
            logger.info(f"Direct invite could not be completed ({error_msg}). Falling back to VIP invite link.")
            error_detail = error_msg
            direct_added = False

    gatekeeper = MembershipGatekeeperService(gateway)
    expires_at = now + timedelta(days=payload.duration_days)

    if direct_added:
        uid = int(target) if target.isdigit() else None
        uname = None if target.isdigit() else target.lstrip("@")
        direct_link = None
        try:
            direct_link = await gateway.create_channel_invite_link(
                channel_id=payload.channel_id,
                request_needed=True,
                title=f"VIP - {target}",
                account_id=payload.account_id,
            )
        except Exception as link_err:
            logger.warning(f"Could not auto-generate invite link on direct add: {link_err}")

        try:
            await pg_repo.connect()
            if pg_repo.pool:
                async with pg_repo.pool.acquire() as conn:
                    await conn.execute(
                        """
                        INSERT INTO channel_memberships (
                            id, tenant_id, channel_id, telegram_user_id, telegram_username,
                            invite_link, status, joined_at, expires_at, created_at, updated_at
                        )
                        VALUES (
                            gen_random_uuid(), $1::uuid, $2, $3, $4,
                            $5, 'ACTIVE', $6, $7, $6, $6
                        )
                        """,
                        tenant_id,
                        payload.channel_id,
                        uid,
                        uname,
                        direct_link,
                        now,
                        expires_at,
                    )
        except Exception as ex:
            logger.warning(f"Error persisting direct added membership: {ex}")

        return {
            "success": True,
            "direct_added": True,
            "message": f"Usuario {target} agregado directamente al canal/grupo.",
            "channel_id": payload.channel_id,
            "target": target,
            "duration_days": payload.duration_days,
            "expires_at": expires_at.isoformat(),
        }

    # Generate VIP link (either direct_invite=False or fallback because of privacy restrictions)
    membership = await gatekeeper.generate_pass(
        tenant_id=tenant_id,
        channel_id=payload.channel_id,
        duration_days=payload.duration_days,
        account_id=payload.account_id,
        request_needed=True,
        title=f"VIP - {target}",
    )
    invite_link = membership.invite_link
    uname = None if target.isdigit() else target.lstrip("@")
    uid = int(target) if target.isdigit() else None

    # Persist pending VIP pass
    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO channel_memberships (
                        id, tenant_id, channel_id, telegram_user_id, telegram_username,
                        invite_link, status, expires_at, created_at, updated_at
                    )
                    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'INVITED', $7::timestamptz, NOW(), NOW())
                    """,
                    membership.id,
                    tenant_id,
                    membership.channel_id,
                    uid,
                    uname,
                    invite_link,
                    membership.expires_at,
                )
    except Exception as ex:
        logger.warning(f"Error persisting generated VIP pass: {ex}")

    if payload.auto_send_dm and invite_link:
        dm_text = (
            f"👋 ¡Hola! Te compartimos tu pase de acceso VIP exclusivo:\n\n"
            f"🔗 Enlace de ingreso (válido para 1 uso):\n{invite_link}\n\n"
            f"⏳ Validez: {payload.duration_days} días.\n"
            f"¡Bienvenido a la comunidad!"
        )
        try:
            dm_sent = await gateway.send_direct_message(
                recipient=target,
                text=dm_text,
                account_id=payload.account_id,
            )
        except Exception as ex:
            logger.warning(f"Could not auto-send VIP invite DM: {ex}")
            dm_sent = False

    return {
        "success": True,
        "direct_added": False,
        "invite_link": invite_link,
        "dm_sent": dm_sent,
        "message": (
            "Enlace VIP generado y enviado directamente al chat del usuario."
            if dm_sent
            else "Enlace VIP generado con éxito."
        ),
        "fallback_reason": error_detail,
        "channel_id": payload.channel_id,
        "target": target,
        "duration_days": payload.duration_days,
    }


@router.post("/gatekeeper/kick")
async def kick_channel_member(
    payload: KickMemberPayload,
    current_user: User = Depends(get_current_user),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    pg_repo: Any = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Manually kick a member from a channel for disciplinary or rule violation reasons."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    success = await gateway.kick_chat_member(
        channel_id=payload.channel_id,
        user_id=payload.user_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo expulsar al miembro en Telegram MTProto. Verifique permisos de administrador.",
        )

    now = datetime.now(timezone.utc)
    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                if payload.membership_id:
                    await conn.execute(
                        """
                        UPDATE channel_memberships
                        SET status = 'KICKED', kick_reason = $1, updated_at = $2
                        WHERE id = $3::uuid AND tenant_id = $4::uuid
                        """,
                        payload.reason,
                        now,
                        payload.membership_id,
                        tenant_id,
                    )
                else:
                    await conn.execute(
                        """
                        UPDATE channel_memberships
                        SET status = 'KICKED', kick_reason = $1, updated_at = $2
                        WHERE channel_id = $3 AND telegram_user_id = $4 AND tenant_id = $5::uuid
                        """,
                        payload.reason,
                        now,
                        payload.channel_id,
                        payload.user_id,
                        tenant_id,
                    )
                # Audit log
                await conn.execute(
                    """
                    INSERT INTO audit_logs (tenant_id, user_email, action, resource, details)
                    VALUES ($1::uuid, $2, 'KICK_VIP_MEMBER', $3, $4::jsonb)
                    """,
                    tenant_id,
                    current_user.email,
                    f"channel:{payload.channel_id}:user:{payload.user_id}",
                    json.dumps({
                        "channel_id": payload.channel_id,
                        "telegram_user_id": payload.user_id,
                        "membership_id": payload.membership_id,
                        "reason": payload.reason or "Incumplimiento de normas",
                    }),
                )
    except Exception as ex:
        logger.warning(f"Error updating membership status to KICKED in postgres: {ex}")

    return {
        "success": True,
        "channel_id": payload.channel_id,
        "user_id": payload.user_id,
        "status": "KICKED",
        "reason": payload.reason,
    }


@router.post("/gatekeeper/kick-batch")
async def kick_batch_channel_members(
    payload: KickBatchMembersPayload,
    current_user: User = Depends(get_current_user),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    pg_repo: Any = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Kick multiple members from one or more channels in bulk with safe MTProto throttling."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    kicked_count = 0
    failed_count = 0
    errors: list[str] = []
    now = datetime.now(timezone.utc)

    for item in payload.items:
        try:
            success = await gateway.kick_chat_member(
                channel_id=item.channel_id,
                user_id=item.user_id,
                account_id=payload.account_id,
            )
            if success:
                kicked_count += 1
                try:
                    await pg_repo.connect()
                    if pg_repo.pool:
                        async with pg_repo.pool.acquire() as conn:
                            if item.membership_id:
                                await conn.execute(
                                    """
                                    UPDATE channel_memberships
                                    SET status = 'KICKED', kick_reason = $1, updated_at = $2
                                    WHERE id = $3::uuid AND tenant_id = $4::uuid
                                    """,
                                    payload.reason,
                                    now,
                                    item.membership_id,
                                    tenant_id,
                                )
                            else:
                                await conn.execute(
                                    """
                                    UPDATE channel_memberships
                                    SET status = 'KICKED', kick_reason = $1, updated_at = $2
                                    WHERE channel_id = $3 AND telegram_user_id = $4 AND tenant_id = $5::uuid
                                    """,
                                    payload.reason,
                                    now,
                                    item.channel_id,
                                    item.user_id,
                                    tenant_id,
                                )
                except Exception as db_err:
                    logger.warning(f"Failed to update kicked membership {item.membership_id}: {db_err}")
            else:
                failed_count += 1
                errors.append(f"No se pudo expulsar al usuario #{item.user_id} del canal #{item.channel_id}")

            # Safe throttle between MTProto kicks to avoid FloodWait
            await asyncio.sleep(0.35)
        except Exception as ex:
            failed_count += 1
            errors.append(f"Error expulsando usuario #{item.user_id}: {ex}")

    # Audit log
    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO audit_logs (tenant_id, user_email, action, resource, details)
                    VALUES ($1::uuid, $2, 'BATCH_KICK_VIP_MEMBERS', $3, $4::jsonb)
                    """,
                    tenant_id,
                    current_user.email,
                    f"batch_kick:{len(payload.items)}_users",
                    json.dumps({
                        "total_requested": len(payload.items),
                        "kicked_count": kicked_count,
                        "failed_count": failed_count,
                        "reason": payload.reason,
                    }),
                )
    except Exception as audit_err:
        logger.warning(f"Failed to record audit log for batch kick: {audit_err}")

    if kicked_count > 0:
        try:
            from backend.presentation.dependencies import get_alerting_service
            alerting = await get_alerting_service()
            await alerting.send_alert(
                title="Expulsión Masiva de Miembros VIP",
                message=f"Se expulsaron con éxito {kicked_count} miembros VIP ({failed_count} fallidos). Motivo: {payload.reason or 'Sin motivo'}.",
                severity="WARNING",
                recipient=os.getenv("ALERT_TELEGRAM_RECIPIENT", "@Smpyt"),
            )
        except Exception:
            pass

    return {
        "success": True,
        "total_requested": len(payload.items),
        "kicked_count": kicked_count,
        "failed_count": failed_count,
        "errors": errors,
    }


@router.post("/gatekeeper/evict")
async def evict_expired_vip_members(
    current_user: User = Depends(get_current_user),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    pg_repo: Any = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Execute eviction worker to kick all expired VIP channel members immediately."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    gatekeeper = MembershipGatekeeperService(gateway)
    evicted_ids: list[str] = []

    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, tenant_id, channel_id, telegram_user_id, telegram_username,
                           invite_link, status, expires_at
                    FROM channel_memberships
                    WHERE tenant_id = $1::uuid AND status = 'ACTIVE' AND telegram_user_id IS NOT NULL
                    """,
                    tenant_id,
                )
                memberships = [
                    ChannelMembership(
                        id=str(r["id"]),
                        tenant_id=str(r["tenant_id"]),
                        channel_id=r["channel_id"],
                        telegram_user_id=r["telegram_user_id"],
                        telegram_username=r["telegram_username"],
                        invite_link=r["invite_link"],
                        status=MembershipStatus(r["status"]),
                        expires_at=str(r["expires_at"]),
                    )
                    for r in rows
                ]
                evicted = await gatekeeper.evaluate_and_evict_expired(memberships)
                for ev in evicted:
                    await conn.execute(
                        "UPDATE channel_memberships SET status = 'KICKED', updated_at = NOW() WHERE id = $1::uuid",
                        ev.id,
                    )
                    evicted_ids.append(ev.id)
    except Exception as ex:
        logger.warning(f"Error running gatekeeper eviction: {ex}")

    return {"status": "ok", "evicted_count": len(evicted_ids), "evicted_ids": evicted_ids}


@router.post("/gatekeeper/webhooks/payment")
async def process_gatekeeper_payment_webhook(
    payload: PaymentWebhookPayload,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    pg_repo: Any = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Webhook for external payment gateways (Stripe, Crypto, MercadoPago) to issue and deliver VIP access passes."""
    configured_secret = os.getenv("GATEKEEPER_WEBHOOK_SECRET")
    if configured_secret and payload.secret_token and payload.secret_token != configured_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token secreto de webhook inválido.",
        )

    target = payload.user_id_or_username.strip()
    uid = int(target) if target.isdigit() else None
    uname = None if target.isdigit() else target.lstrip("@")

    gatekeeper = MembershipGatekeeperService(gateway)
    membership = await gatekeeper.generate_pass(
        tenant_id="00000000-0000-0000-0000-000000000001",
        channel_id=payload.channel_id,
        duration_days=payload.duration_days,
        account_id=payload.account_id,
        request_needed=True,
        title=f"VIP - {target}",
    )

    dm_sent = False
    dm_error = None
    if payload.auto_send_dm and uname and membership.invite_link:
        dm_text = (
            f"🎉 ¡Gracias por tu compra! Tu suscripción VIP está activa.\n\n"
            f"🔗 Tu enlace exclusivo de ingreso:\n{membership.invite_link}\n\n"
            f"⏳ Validez: {payload.duration_days} días.\n"
            f"Hacé clic en el enlace para solicitar unirte y se te dará acceso inmediato."
        )
        try:
            dm_sent = await gateway.send_direct_message(
                recipient=uname,
                text=dm_text,
                account_id=payload.account_id,
            )
        except Exception as dm_ex:
            logger.warning(f"Error auto-sending purchase DM to {uname}: {dm_ex}")
            dm_sent = False
            dm_error = str(dm_ex)

    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO channel_memberships (
                        id, tenant_id, channel_id, telegram_user_id, telegram_username,
                        invite_link, status, expires_at, created_at, updated_at
                    )
                    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'INVITED', $7::timestamptz, NOW(), NOW())
                    """,
                    membership.id,
                    "00000000-0000-0000-0000-000000000001",
                    membership.channel_id,
                    uid,
                    uname,
                    membership.invite_link,
                    membership.expires_at,
                )
                await conn.execute(
                    """
                    INSERT INTO audit_logs (tenant_id, user_email, action, resource, details)
                    VALUES ($1::uuid, $2, 'GATEKEEPER_PAYMENT_WEBHOOK', $3, $4::jsonb)
                    """,
                    "00000000-0000-0000-0000-000000000001",
                    "webhook@gatekeeper.local",
                    f"payment:{payload.payment_provider}:{payload.payment_id or 'auto'}",
                    json.dumps({
                        "channel_id": payload.channel_id,
                        "target": target,
                        "duration_days": payload.duration_days,
                        "amount": payload.amount,
                        "currency": payload.currency,
                        "payment_provider": payload.payment_provider,
                        "payment_id": payload.payment_id,
                        "invite_link": membership.invite_link,
                        "dm_sent": dm_sent,
                        "dm_error": dm_error,
                    }),
                )
    except Exception as db_err:
        logger.warning(f"Error persisting webhook membership: {db_err}")

    try:
        from backend.presentation.dependencies import get_alerting_service
        alerting = await get_alerting_service()
        amt_info = f" ({payload.amount} {payload.currency})" if payload.amount else ""
        await alerting.send_alert(
            title="Nueva Suscripción VIP",
            message=f"Se procesó un pago de {target}{amt_info} vía {payload.payment_provider} para el canal {payload.channel_id}.\nEnlace generado: {membership.invite_link}\nDM enviado: {'Sí' if dm_sent else 'No'}",
            severity="INFO",
            recipient=os.getenv("ALERT_TELEGRAM_RECIPIENT", "@Smpyt"),
        )
    except Exception as al_err:
        logger.debug(f"Could not dispatch payment alert: {al_err}")

    return {
        "success": True,
        "membership_id": membership.id,
        "channel_id": payload.channel_id,
        "target": target,
        "invite_link": membership.invite_link,
        "expires_at": membership.expires_at,
        "duration_days": payload.duration_days,
        "dm_sent": dm_sent,
        "dm_error": dm_error,
    }


