from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from backend.domain.entities.audit_log import AuditLog
from backend.domain.entities.user import Role, User
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.presentation.dependencies import (
    get_audit_repository,
    get_current_user,
    require_roles,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audit", tags=["Audit"])


class AuditLogResponse(BaseModel):
    id: int
    user_id: int | None = None
    user_email: str | None = None
    action: str
    resource: str | None = None
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    created_at: str | None = None


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None),
    user_email: str | None = Query(None),
    current_user: User = Depends(require_roles([Role.ADMIN])),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> list[AuditLogResponse]:
    """Retrieve audit trail logs with filtering. Restricted to ADMIN users."""
    logs = await audit_repo.list_audit_logs(
        limit=limit,
        offset=offset,
        action=action,
        user_email=user_email,
    )
    return [
        AuditLogResponse(
            id=l.id or 0,
            user_id=l.user_id,
            user_email=l.user_email,
            action=l.action,
            resource=l.resource,
            details=l.details,
            ip_address=l.ip_address,
            created_at=l.created_at,
        )
        for l in logs
    ]
