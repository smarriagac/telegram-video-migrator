from __future__ import annotations

from datetime import datetime, timezone
import logging
import math
from typing import Any
from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel

from backend.domain.entities.audit_log import AuditLog
from backend.domain.entities.user import Role, User
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.application.services.report_exporter_service import ReportExporterService
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


class PaginatedAuditResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/export")
async def export_audit_logs(
    format: str = Query("csv", pattern="^(csv|json|html)$"),
    action: str | None = Query(None),
    user_email: str | None = Query(None),
    limit: int = Query(2000, ge=1, le=10000),
    current_user: User = Depends(require_roles([Role.ADMIN])),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> Response:
    """Export filtered audit logs into CSV, JSON, or printable HTML format."""
    logs = await audit_repo.list_audit_logs(
        limit=limit,
        offset=0,
        action=action,
        user_email=user_email,
    )
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if format == "csv":
        csv_content = ReportExporterService.generate_audit_csv(logs)
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="audit_report_{timestamp}.csv"'
            },
        )
    elif format == "json":
        json_content = ReportExporterService.generate_audit_json(logs)
        return Response(
            content=json_content,
            media_type="application/json; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="audit_report_{timestamp}.json"'
            },
        )
    else:  # html
        html_content = ReportExporterService.generate_audit_html(logs)
        return Response(
            content=html_content,
            media_type="text/html; charset=utf-8",
            headers={
                "Content-Disposition": f'inline; filename="audit_report_{timestamp}.html"'
            },
        )


@router.get("", response_model=PaginatedAuditResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    action: str | None = Query(None),
    user_email: str | None = Query(None),
    current_user: User = Depends(require_roles([Role.ADMIN])),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> PaginatedAuditResponse:
    """Retrieve audit trail logs with pagination and filtering. Restricted to ADMIN users."""
    offset = (page - 1) * page_size
    total = await audit_repo.count_audit_logs(action=action, user_email=user_email)
    logs = await audit_repo.list_audit_logs(
        limit=page_size,
        offset=offset,
        action=action,
        user_email=user_email,
    )
    total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1
    return PaginatedAuditResponse(
        items=[
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
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
