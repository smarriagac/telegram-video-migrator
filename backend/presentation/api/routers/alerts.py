from __future__ import annotations

import json
import logging
import os
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.domain.entities.user import User, Role
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.application.services.alerting_service import AlertingService
from backend.presentation.dependencies import (
    get_current_user,
    get_telegram_gateway,
    get_postgres_repository,
    require_roles,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["Operational Alerts & Monitoring"])


class AlertConfigRequest(BaseModel):
    alert_recipient: str | None = None
    alert_channel_id: int | None = None
    notify_flood_wait: bool = True
    notify_job_failures: bool = True
    notify_vip_purchases: bool = True
    notify_evictions: bool = True


class TestAlertRequest(BaseModel):
    recipient: str | None = None
    channel_id: int | None = None
    severity: str = "INFO"
    custom_message: str | None = None


@router.get("/config")
async def get_alert_config(
    current_user: User = Depends(get_current_user),
    pg_repo: Any = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Retrieve operational alert configuration for the current tenant."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT details FROM audit_logs WHERE tenant_id = $1::uuid AND action = 'ALERT_CONFIG_UPDATE' ORDER BY created_at DESC LIMIT 1",
                    tenant_id,
                )
                if row and row["details"]:
                    details = json.loads(row["details"]) if isinstance(row["details"], str) else row["details"]
                    return {"config": details}
    except Exception as e:
        logger.warning(f"Could not fetch alert config: {e}")

    # Fallback default from env
    return {
        "config": {
            "alert_recipient": os.getenv("ALERT_TELEGRAM_RECIPIENT", "@Smpyt"),
            "alert_channel_id": None,
            "notify_flood_wait": True,
            "notify_job_failures": True,
            "notify_vip_purchases": True,
            "notify_evictions": True,
        }
    }


@router.post("/config")
async def save_alert_config(
    payload: AlertConfigRequest,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    pg_repo: Any = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Persist operational alert settings for the current tenant."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    try:
        await pg_repo.connect()
        if pg_repo.pool:
            async with pg_repo.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO audit_logs (tenant_id, user_email, action, resource, details)
                    VALUES ($1::uuid, $2, 'ALERT_CONFIG_UPDATE', 'system:alerts', $3::jsonb)
                    """,
                    tenant_id,
                    current_user.email,
                    json.dumps(payload.model_dump()),
                )
    except Exception as e:
        logger.warning(f"Could not persist alert config: {e}")

    return {"success": True, "config": payload.model_dump()}


@router.post("/test")
async def send_test_alert(
    payload: TestAlertRequest,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Dispatch a live test alert to verify MTProto connectivity and notification delivery."""
    service = AlertingService(gateway)
    target_rec = payload.recipient or "@Smpyt"
    msg = payload.custom_message or "Esta es una alerta de prueba del sistema Telegram Hub. Todo el pipeline de monitoreo operativo se encuentra activo."

    delivered = await service.send_alert(
        title="Verificación de Conectividad",
        message=msg,
        severity=payload.severity,
        recipient=target_rec,
        channel_id=payload.channel_id,
    )

    if not delivered:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo entregar la alerta a {target_rec}. Verificá la privacidad o si el usuario inició conversación con la cuenta.",
        )

    return {"success": True, "delivered_to": target_rec, "severity": payload.severity}
