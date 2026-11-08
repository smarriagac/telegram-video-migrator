from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from backend.domain.entities.user import User
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.application.services.big_media_upload_service import (
    BigMediaUploadService,
    get_big_media_upload_service,
)
from backend.presentation.dependencies import (
    get_current_user,
    get_telegram_gateway,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media/upload", tags=["Big Media Resumable Upload"])


class InitUploadRequest(BaseModel):
    filename: str = Field(..., description="Original filename of the media")
    file_size_bytes: int = Field(..., gt=0, description="Total size in bytes")
    mime_type: str = Field(default="video/mp4", description="MIME type of media")
    target_channel_id: int = Field(..., description="Target Telegram Channel/Chat ID")
    caption: str | None = Field(default=None, description="Optional caption for the post")
    account_id: int | None = Field(default=None, description="Account ID to use for dispatch")
    chunk_size: int | None = Field(default=None, description="Optional custom chunk size in bytes")


class InitUploadResponse(BaseModel):
    upload_id: str
    filename: str
    file_size_bytes: int
    chunk_size: int
    total_chunks: int
    status: str


class ChunkUploadResponse(BaseModel):
    upload_id: str
    chunk_index: int
    completed_chunks: list[int]
    progress_percent: float


class UploadStatusResponse(BaseModel):
    upload_id: str
    filename: str
    file_size_bytes: int
    chunk_size: int
    total_chunks: int
    completed_chunks: list[int]
    missing_chunks: list[int]
    progress_percent: float
    status: str


class CompleteUploadResponse(BaseModel):
    success: bool
    upload_id: str
    message_id: int
    channel_id: int
    file_size: int
    text: str | None = None


@router.post("/init", response_model=InitUploadResponse)
async def init_big_media_upload(
    req: InitUploadRequest,
    current_user: User = Depends(get_current_user),
    service: BigMediaUploadService = Depends(get_big_media_upload_service),
) -> InitUploadResponse:
    """Initialize a chunked resumable upload session for large media files."""
    try:
        meta = await service.init_session(
            filename=req.filename,
            file_size_bytes=req.file_size_bytes,
            mime_type=req.mime_type,
            target_channel_id=req.target_channel_id,
            caption=req.caption,
            account_id=req.account_id,
            chunk_size=req.chunk_size,
        )
        return InitUploadResponse(
            upload_id=meta["upload_id"],
            filename=meta["filename"],
            file_size_bytes=meta["file_size_bytes"],
            chunk_size=meta["chunk_size"],
            total_chunks=meta["total_chunks"],
            status=meta["status"],
        )
    except Exception as e:
        logger.error(f"Failed to initialize big media upload: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize upload session: {str(e)}",
        )


@router.post("/{upload_id}/chunk", response_model=ChunkUploadResponse)
async def upload_media_chunk(
    upload_id: str,
    request: Request,
    chunk_index: int = Query(..., ge=0, description="Zero-based index of this chunk"),
    current_user: User = Depends(get_current_user),
    service: BigMediaUploadService = Depends(get_big_media_upload_service),
) -> ChunkUploadResponse:
    """Upload a single chunk slice (typically 5MB) for a session."""
    try:
        chunk_bytes = await request.body()
        if not chunk_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty chunk payload received.",
            )

        result = await service.save_chunk(
            upload_id=upload_id,
            chunk_index=chunk_index,
            chunk_bytes=chunk_bytes,
        )
        return ChunkUploadResponse(**result)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error saving chunk {chunk_index} for upload {upload_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save chunk: {str(e)}",
        )


@router.get("/{upload_id}/status", response_model=UploadStatusResponse)
async def get_upload_status(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    service: BigMediaUploadService = Depends(get_big_media_upload_service),
) -> UploadStatusResponse:
    """Check progress of uploaded chunks to enable resuming interrupted uploads."""
    try:
        status_info = await service.get_session_status(upload_id)
        return UploadStatusResponse(**status_info)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to get upload status for {upload_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/{upload_id}/complete", response_model=CompleteUploadResponse)
async def complete_big_media_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    service: BigMediaUploadService = Depends(get_big_media_upload_service),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> CompleteUploadResponse:
    """Assemble chunks and transmit as a stream to Telegram MTProto."""
    try:
        result = await service.complete_and_transmit(upload_id=upload_id, gateway=gateway)
        return CompleteUploadResponse(**result)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to complete big media upload {upload_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload completion failed: {str(e)}",
        )


@router.delete("/{upload_id}")
async def cancel_big_media_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    service: BigMediaUploadService = Depends(get_big_media_upload_service),
) -> dict[str, Any]:
    """Abort upload and delete scratch files."""
    try:
        cancelled = await service.cancel_session(upload_id)
        return {"cancelled": cancelled, "upload_id": upload_id}
    except Exception as e:
        logger.error(f"Error cancelling upload {upload_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
