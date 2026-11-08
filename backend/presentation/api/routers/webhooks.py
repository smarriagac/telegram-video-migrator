from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.domain.entities.user import User, Role
from backend.domain.entities.webhook_endpoint import WebhookEndpoint
from backend.domain.ports.webhook_repository_port import WebhookRepositoryPort
from backend.application.services.webhook_dispatcher_service import WebhookDispatcherService
from backend.application.services.webhook_retry_engine import WebhookRetryEngine
from backend.presentation.dependencies import (
    get_current_user,
    require_roles,
    get_webhook_repository,
    get_webhook_dispatcher,
    get_webhook_retry_engine,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Operational Multichannel Webhooks"])


class CreateWebhookRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    target_type: str = Field("GENERIC", pattern="^(DISCORD|SLACK|TELEGRAM_BOT|GENERIC)$")
    url: str = Field(..., min_length=8)
    secret_token: str | None = None
    events: list[str] = Field(default_factory=lambda: ["job.failed", "flood_wait", "backup.created", "channel.eviction"])
    is_enabled: bool = True


class UpdateWebhookRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=128)
    target_type: str | None = Field(None, pattern="^(DISCORD|SLACK|TELEGRAM_BOT|GENERIC)$")
    url: str | None = Field(None, min_length=8)
    secret_token: str | None = None
    events: list[str] | None = None
    is_enabled: bool | None = None


class TestWebhookUrlRequest(BaseModel):
    target_type: str = "GENERIC"
    url: str
    secret_token: str | None = None


@router.get("")
async def list_webhooks(
    is_enabled: bool | None = None,
    current_user: User = Depends(get_current_user),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> list[dict[str, Any]]:
    """List all configured webhooks for the current tenant."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    endpoints = await repo.list_webhooks(tenant_id=tenant_id, is_enabled=is_enabled)
    return [ep.to_dict() for ep in endpoints]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_webhook(
    payload: CreateWebhookRequest,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> dict[str, Any]:
    """Register a new multichannel webhook endpoint."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    endpoint = WebhookEndpoint(
        name=payload.name.strip(),
        target_type=payload.target_type.upper(),
        url=payload.url.strip(),
        tenant_id=tenant_id,
        secret_token=payload.secret_token.strip() if payload.secret_token else None,
        events=payload.events,
        is_enabled=payload.is_enabled,
    )
    created = await repo.create_webhook(endpoint)
    return created.to_dict()


@router.post("/test-url")
async def test_webhook_url(
    payload: TestWebhookUrlRequest,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    dispatcher: WebhookDispatcherService = Depends(get_webhook_dispatcher),
) -> dict[str, Any]:
    """Perform a dry-run test ping against a webhook URL without saving it."""
    temp_ep = WebhookEndpoint(
        name="Prueba Temporal",
        target_type=payload.target_type.upper(),
        url=payload.url.strip(),
        secret_token=payload.secret_token.strip() if payload.secret_token else None,
    )
    success, status_code, err = await dispatcher.dispatch_to_endpoint(
        endpoint=temp_ep,
        event_type="test.ping",
        title="Verificación de Webhook",
        message="Esta es una prueba de conectividad enviada desde Telegram Hub.",
        severity="INFO",
        metadata={"usuario": current_user.email, "test": True},
        max_retries=1,
    )
    return {
        "success": success,
        "status_code": status_code,
        "error": err,
    }


# --- Delivery Audit & Dead-Letter Queue (DLQ) Endpoints ---


@router.get("/deliveries/summary")
async def get_deliveries_summary(
    current_user: User = Depends(get_current_user),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> dict[str, Any]:
    """Retrieve count summaries of deliveries, pending retries, and DLQ entries."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    return await repo.get_dlq_summary(tenant_id=tenant_id)


@router.get("/deliveries/dlq")
async def list_dead_letter_deliveries(
    webhook_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> dict[str, Any]:
    """List all dead-letter deliveries that exhausted automated retries."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    items, total = await repo.get_dead_letter_deliveries(
        tenant_id=tenant_id,
        webhook_id=webhook_id,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [d.to_dict() for d in items],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/deliveries")
async def list_deliveries(
    webhook_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> dict[str, Any]:
    """List webhook delivery audit records with filtering and pagination."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    items, total = await repo.list_deliveries(
        tenant_id=tenant_id,
        webhook_id=webhook_id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [d.to_dict() for d in items],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/deliveries/{delivery_id}/retry")
async def retry_delivery(
    delivery_id: str,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    retry_engine: WebhookRetryEngine = Depends(get_webhook_retry_engine),
) -> dict[str, Any]:
    """Force an immediate re-dispatch attempt for a failed or dead-letter delivery."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    success, status_code, err = await retry_engine.retry_single_delivery(
        delivery_id=delivery_id,
        tenant_id=tenant_id,
    )
    return {
        "success": success,
        "status_code": status_code,
        "error": err,
        "delivery_id": delivery_id,
    }


@router.post("/deliveries/dlq/retry-all")
async def retry_all_dlq_deliveries(
    webhook_id: str | None = None,
    limit: int = 100,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    retry_engine: WebhookRetryEngine = Depends(get_webhook_retry_engine),
) -> dict[str, Any]:
    """1-Click batch redelivery of all dead-letter webhooks."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    res = await retry_engine.retry_all_dlq(
        tenant_id=tenant_id,
        webhook_id=webhook_id,
        limit=limit,
    )
    return res


@router.delete("/deliveries/{delivery_id}")
async def dismiss_delivery(
    delivery_id: str,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> dict[str, Any]:
    """Dismiss or delete a delivery record from DLQ."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    deleted = await repo.delete_delivery(delivery_id=delivery_id, tenant_id=tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    return {"success": True, "deleted_id": delivery_id}


@router.get("/{webhook_id}")
async def get_webhook_details(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> dict[str, Any]:
    """Retrieve details of a specific webhook."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    endpoint = await repo.get_webhook(webhook_id=webhook_id, tenant_id=tenant_id)
    if not endpoint:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")
    return endpoint.to_dict()


@router.put("/{webhook_id}")
async def update_webhook(
    webhook_id: str,
    payload: UpdateWebhookRequest,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> dict[str, Any]:
    """Update configuration of an existing webhook endpoint."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    existing = await repo.get_webhook(webhook_id=webhook_id, tenant_id=tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    if payload.name is not None:
        existing.name = payload.name.strip()
    if payload.target_type is not None:
        existing.target_type = payload.target_type.upper()
    if payload.url is not None:
        existing.url = payload.url.strip()
    if payload.secret_token is not None:
        existing.secret_token = payload.secret_token.strip() if payload.secret_token else None
    if payload.events is not None:
        existing.events = payload.events
    if payload.is_enabled is not None:
        existing.is_enabled = payload.is_enabled

    updated = await repo.update_webhook(existing)
    if not updated:
        raise HTTPException(status_code=500, detail="Error al actualizar webhook")
    return updated.to_dict()


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
) -> dict[str, Any]:
    """Remove a webhook endpoint."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    deleted = await repo.delete_webhook(webhook_id=webhook_id, tenant_id=tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")
    return {"success": True, "deleted_id": webhook_id}


@router.post("/{webhook_id}/test")
async def test_saved_webhook(
    webhook_id: str,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    repo: WebhookRepositoryPort = Depends(get_webhook_repository),
    dispatcher: WebhookDispatcherService = Depends(get_webhook_dispatcher),
) -> dict[str, Any]:
    """Trigger an immediate live test ping to a configured webhook endpoint."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    endpoint = await repo.get_webhook(webhook_id=webhook_id, tenant_id=tenant_id)
    if not endpoint:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    success, status_code, err = await dispatcher.dispatch_to_endpoint(
        endpoint=endpoint,
        event_type="test.ping",
        title="Prueba de Webhook Operativo",
        message=f"Mensaje de prueba enviado exitosamente a {endpoint.name} ({endpoint.target_type}).",
        severity="INFO",
        metadata={"webhook_id": endpoint.id, "test": True},
        max_retries=1,
    )

    return {
        "success": success,
        "status_code": status_code,
        "error": err,
        "endpoint": endpoint.to_dict(),
    }
