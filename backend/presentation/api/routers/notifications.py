from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from backend.domain.entities.app_notification import AppNotification
from backend.domain.entities.user import User
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.application.broadcaster import EventBroadcaster
from backend.presentation.dependencies import get_current_user, get_job_repository, get_broadcaster

logger = logging.getLogger("telegram_migrator.notifications_api")
router = APIRouter(prefix="/notifications", tags=["In-App Notifications"])


class AppNotificationItem(BaseModel):
    id: str
    tenant_id: str
    title: str
    message: str
    severity: str
    is_read: bool
    link: str | None = None
    created_at: str | None = None


class UnreadCountResponse(BaseModel):
    unread_count: int


class CreateNotificationRequest(BaseModel):
    title: str
    message: str
    severity: str = "INFO"
    link: str | None = None


@router.get("", response_model=list[AppNotificationItem])
async def list_notifications_endpoint(
    limit: int = Query(30, ge=1, le=100),
    unread_only: bool = Query(False),
    repo: JobRepositoryPort = Depends(get_job_repository),
    current_user: User = Depends(get_current_user),
) -> list[AppNotificationItem]:
    """Retrieve recent notifications for current tenant, optionally filtered to unread."""
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"
    notifs = await repo.list_notifications(
        tenant_id=tenant_id,
        limit=limit,
        unread_only=unread_only,
    )
    return [
        AppNotificationItem(
            id=n.id,
            tenant_id=n.tenant_id,
            title=n.title,
            message=n.message,
            severity=n.severity,
            is_read=n.is_read,
            link=n.link,
            created_at=n.created_at,
        )
        for n in notifs
    ]


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count_endpoint(
    repo: JobRepositoryPort = Depends(get_job_repository),
    current_user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    """Fast endpoint returning the unread notification count for badge rendering."""
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"
    count = await repo.get_unread_notifications_count(tenant_id=tenant_id)
    return UnreadCountResponse(unread_count=count)


@router.patch("/{notification_id}/read")
async def mark_notification_read_endpoint(
    notification_id: str,
    repo: JobRepositoryPort = Depends(get_job_repository),
    current_user: User = Depends(get_current_user),
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
) -> dict[str, Any]:
    """Mark a single notification as read."""
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"
    updated = await repo.mark_notification_as_read(
        notification_id=notification_id, tenant_id=tenant_id
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notificación no encontrada.",
        )
    await broadcaster.publish(
        "global_events",
        {"type": "NOTIFICATION_UPDATE", "data": {"action": "READ", "notification_id": notification_id}},
    )
    return {"status": "SUCCESS", "notification_id": notification_id}


@router.post("/read-all")
async def mark_all_notifications_read_endpoint(
    repo: JobRepositoryPort = Depends(get_job_repository),
    current_user: User = Depends(get_current_user),
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
) -> dict[str, Any]:
    """Mark all unread notifications for tenant as read."""
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"
    count = await repo.mark_all_notifications_as_read(tenant_id=tenant_id)
    await broadcaster.publish(
        "global_events",
        {"type": "NOTIFICATION_UPDATE", "data": {"action": "READ_ALL", "count": count}},
    )
    return {"status": "SUCCESS", "marked_read_count": count}


@router.post("", response_model=AppNotificationItem, status_code=status.HTTP_201_CREATED)
async def create_notification_endpoint(
    payload: CreateNotificationRequest,
    repo: JobRepositoryPort = Depends(get_job_repository),
    current_user: User = Depends(get_current_user),
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
) -> AppNotificationItem:
    """Create a new manual or system notification for the current tenant."""
    tenant_id = getattr(current_user, "tenant_id", "default") or "default"
    notif = AppNotification.create(
        title=payload.title,
        message=payload.message,
        severity=payload.severity,
        tenant_id=tenant_id,
        link=payload.link,
    )
    saved = await repo.save_notification(notif)
    await broadcaster.publish(
        "global_events",
        {
            "type": "NOTIFICATION_UPDATE",
            "data": {
                "action": "NEW",
                "notification_id": saved.id,
                "title": saved.title,
                "severity": saved.severity,
            },
        },
    )
    return AppNotificationItem(
        id=saved.id,
        tenant_id=saved.tenant_id,
        title=saved.title,
        message=saved.message,
        severity=saved.severity,
        is_read=saved.is_read,
        link=saved.link,
        created_at=saved.created_at,
    )
