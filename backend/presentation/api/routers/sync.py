from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.domain.entities.audit_log import AuditLog
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.presentation.dependencies import (
    get_audit_repository,
    get_job_repository,
    get_live_sync_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sync", tags=["Live Sync Hub"])


class SyncBindingItem(BaseModel):
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


class CreateSyncBindingRequest(BaseModel):
    source_channel_id: int
    target_channel_id: int
    is_active: bool = True
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    caption_rules: dict | None = None
    media_filter_rules: dict | None = None


class UpdateSyncBindingRequest(BaseModel):
    is_active: bool | None = None
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    caption_rules: dict | None = None
    media_filter_rules: dict | None = None


class SyncHealthResponse(BaseModel):
    is_running: bool
    active_sources_count: int
    active_bindings_count: int
    attached_clients_count: int
    queue_depth: int


@router.get("/bindings", response_model=list[SyncBindingItem])
async def list_sync_bindings(
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> list[SyncBindingItem]:
    """List all real-time channel sync pairs."""
    bindings = await repo.list_sync_bindings()
    return [
        SyncBindingItem(
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


@router.post("/bindings", response_model=SyncBindingItem, status_code=status.HTTP_201_CREATED)
async def create_or_update_binding(
    req: CreateSyncBindingRequest,
    live_sync_svc: Any = Depends(get_live_sync_service),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> SyncBindingItem:
    """Create or update a real-time auto-sync binding between two channels."""
    binding = await live_sync_svc.set_binding(
        source_channel_id=req.source_channel_id,
        target_channel_id=req.target_channel_id,
        is_active=req.is_active,
        source_title=req.source_channel_title,
        target_title=req.target_channel_title,
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
                action="LIVE_SYNC_CREATE_OR_UPDATE",
                resource=f"sync:{req.source_channel_id}->{req.target_channel_id}",
                details={
                    "is_active": req.is_active,
                    "source_title": req.source_channel_title,
                    "target_title": req.target_channel_title,
                    "caption_rules": req.caption_rules,
                    "media_filter_rules": req.media_filter_rules,
                },
            )
        )
    except Exception as e:
        logger.warning(f"Failed to record audit log for sync binding: {e}")

    return SyncBindingItem(
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


@router.patch("/bindings/{source_channel_id}/{target_channel_id}", response_model=SyncBindingItem)
async def update_sync_binding(
    source_channel_id: int,
    target_channel_id: int,
    req: UpdateSyncBindingRequest,
    live_sync_svc: Any = Depends(get_live_sync_service),
    repo: JobRepositoryPort = Depends(get_job_repository),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> SyncBindingItem:
    """Update active state or rules of an existing auto-sync binding."""
    existing = await repo.get_sync_binding(source_channel_id, target_channel_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sync binding {source_channel_id}->{target_channel_id} not found",
        )

    is_active = req.is_active if req.is_active is not None else existing.is_active
    source_title = req.source_channel_title or existing.source_channel_title
    target_title = req.target_channel_title or existing.target_channel_title
    caption_rules = req.caption_rules if req.caption_rules is not None else existing.caption_rules
    media_filter_rules = req.media_filter_rules if req.media_filter_rules is not None else existing.media_filter_rules

    binding = await live_sync_svc.set_binding(
        source_channel_id=source_channel_id,
        target_channel_id=target_channel_id,
        is_active=is_active,
        source_title=source_title,
        target_title=target_title,
        source_account_id=existing.source_account_id,
        target_account_id=existing.target_account_id,
        caption_rules=caption_rules,
        media_filter_rules=media_filter_rules,
    )

    try:
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=None,
                user_email=None,
                action="LIVE_SYNC_PATCH",
                resource=f"sync:{source_channel_id}->{target_channel_id}",
                details={"is_active": is_active, "rules_updated": req.caption_rules is not None or req.media_filter_rules is not None},
            )
        )
    except Exception as e:
        logger.warning(f"Failed to record audit log for sync patch: {e}")

    return SyncBindingItem(
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


@router.delete("/bindings/{source_channel_id}/{target_channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sync_binding(
    source_channel_id: int,
    target_channel_id: int,
    live_sync_svc: Any = Depends(get_live_sync_service),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> None:
    """Unlink and delete an auto-sync binding."""
    await live_sync_svc.delete_binding(source_channel_id, target_channel_id)
    try:
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=None,
                user_email=None,
                action="LIVE_SYNC_DELETE",
                resource=f"sync:{source_channel_id}->{target_channel_id}",
                details={"status": "deleted"},
            )
        )
    except Exception as e:
        logger.warning(f"Failed to record audit log for sync delete: {e}")


@router.post("/reload")
async def reload_live_sync(
    live_sync_svc: Any = Depends(get_live_sync_service),
) -> dict[str, str]:
    """Force reload of active bindings and reattach Telethon push listeners."""
    await live_sync_svc.reload_bindings()
    live_sync_svc.attach_client_listeners()
    return {"status": "reloaded"}


@router.get("/health", response_model=SyncHealthResponse)
async def get_live_sync_health(
    live_sync_svc: Any = Depends(get_live_sync_service),
) -> SyncHealthResponse:
    """Check health and listener status of the MTProto live sync background service."""
    metrics = live_sync_svc.get_health_status()
    return SyncHealthResponse(
        is_running=metrics.get("is_running", False),
        active_sources_count=metrics.get("active_sources_count", 0),
        active_bindings_count=metrics.get("active_bindings_count", 0),
        attached_clients_count=metrics.get("attached_clients_count", 0),
        queue_depth=metrics.get("queue_depth", 0),
    )
