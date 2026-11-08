from __future__ import annotations

from typing import Protocol
from backend.domain.entities.webhook_endpoint import WebhookEndpoint


class WebhookRepositoryPort(Protocol):
    """Port defining persistence operations for webhook endpoints."""

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
