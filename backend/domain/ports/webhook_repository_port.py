from __future__ import annotations

from typing import Protocol, Any
from backend.domain.entities.webhook_endpoint import WebhookEndpoint
from backend.domain.entities.webhook_delivery import WebhookDelivery


class WebhookRepositoryPort(Protocol):
    """Port defining persistence operations for webhook endpoints and deliveries."""

    async def initialize_schema(self) -> None:
        """Create tables and indexes if they do not exist."""
        ...

    async def list_webhooks(
        self,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
        is_enabled: bool | None = None,
    ) -> list[WebhookEndpoint]:
        """List all webhooks belonging to a tenant."""
        ...

    async def get_webhook(
        self,
        webhook_id: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> WebhookEndpoint | None:
        """Retrieve a specific webhook endpoint by ID."""
        ...

    async def create_webhook(
        self,
        webhook: WebhookEndpoint,
    ) -> WebhookEndpoint:
        """Persist a new webhook endpoint."""
        ...

    async def update_webhook(
        self,
        webhook: WebhookEndpoint,
    ) -> WebhookEndpoint | None:
        """Update an existing webhook endpoint."""
        ...

    async def delete_webhook(
        self,
        webhook_id: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> bool:
        """Remove a webhook endpoint."""
        ...

    async def record_dispatch_result(
        self,
        webhook_id: str,
        tenant_id: str,
        status_code: int | None,
        error: str | None,
    ) -> None:
        """Record the outcome of a webhook delivery attempt."""
        ...

    # --- Delivery & DLQ Operations ---

    async def create_delivery(
        self,
        delivery: WebhookDelivery,
    ) -> WebhookDelivery:
        """Persist a new delivery attempt or queued retry."""
        ...

    async def get_delivery(
        self,
        delivery_id: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> WebhookDelivery | None:
        """Retrieve a specific delivery by ID."""
        ...

    async def update_delivery(
        self,
        delivery: WebhookDelivery,
    ) -> WebhookDelivery | None:
        """Update an existing delivery status, attempts, or backoff time."""
        ...

    async def list_deliveries(
        self,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
        webhook_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[WebhookDelivery], int]:
        """List delivery audit records matching filters with total count."""
        ...

    async def get_pending_retries(
        self,
        limit: int = 20,
    ) -> list[WebhookDelivery]:
        """Retrieve deliveries that are pending retry and due for execution."""
        ...

    async def get_dead_letter_deliveries(
        self,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
        webhook_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[WebhookDelivery], int]:
        """Retrieve all dead-letter (DLQ) failed deliveries."""
        ...

    async def get_dlq_summary(
        self,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> dict[str, Any]:
        """Aggregated summary of delivery statuses (DLQ, pending, delivered)."""
        ...

    async def delete_delivery(
        self,
        delivery_id: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> bool:
        """Remove/dismiss a delivery record."""
        ...
