from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import os
from typing import Any
import asyncpg

from backend.domain.entities.webhook_endpoint import WebhookEndpoint
from backend.domain.ports.webhook_repository_port import WebhookRepositoryPort

logger = logging.getLogger(__name__)


class PostgresWebhookRepository(WebhookRepositoryPort):
    """PostgreSQL repository for webhook endpoints with memory fallback."""

    def __init__(self, db_url: str | None = None) -> None:
        self.db_url = db_url or os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@localhost:7902/telegram_hub"
        )
        self.pool: asyncpg.Pool | None = None
        self._fallback_mode = False
        self._memory_webhooks: dict[str, WebhookEndpoint] = {}
        self._initialized = False

    async def connect(self) -> None:
        import asyncio
        current_loop = asyncio.get_running_loop()
        if self.pool is not None:
            if getattr(self.pool, "_loop", None) is not current_loop:
                self.pool = None
            else:
                return
        try:
            self.pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=5, timeout=1.0)
            self._fallback_mode = False
        except Exception as e:
            logger.warning(f"PostgresWebhookRepository: Could not connect to {self.db_url}: {e}. Fallback to memory.")
            self._fallback_mode = True

    async def initialize_schema(self) -> None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            self._initialized = True
            return

        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS webhook_endpoints (
                    id VARCHAR(64) PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
                    name VARCHAR(128) NOT NULL,
                    target_type VARCHAR(32) NOT NULL DEFAULT 'GENERIC',
                    url TEXT NOT NULL,
                    secret_token TEXT,
                    events JSONB NOT NULL DEFAULT '["job.failed", "flood_wait", "backup.created", "channel.eviction"]'::jsonb,
                    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    last_status_code INT,
                    last_error TEXT,
                    last_dispatched_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_webhook_tenant ON webhook_endpoints(tenant_id);
            """)
        self._initialized = True

    async def _ensure_connection(self) -> None:
        import asyncio
        current_loop = asyncio.get_running_loop()
        if self.pool is not None and getattr(self.pool, "_loop", None) is not current_loop:
            self.pool = None
            self._initialized = False

        if not self._initialized or self.pool is None:
            await self.initialize_schema()

    def _ensure_datetime(self, dt: Any) -> datetime | None:
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt
        try:
            return datetime.fromisoformat(str(dt))
        except Exception:
            return None

    def _row_to_endpoint(self, row: dict[str, Any]) -> WebhookEndpoint:
        events = row.get("events")
        if isinstance(events, str):
            try:
                events = json.loads(events)
            except Exception:
                events = ["job.failed", "flood_wait", "backup.created", "channel.eviction"]
        elif not isinstance(events, list):
            events = ["job.failed", "flood_wait", "backup.created", "channel.eviction"]

        return WebhookEndpoint(
            id=row["id"],
            tenant_id=str(row["tenant_id"]),
            name=row["name"],
            target_type=row.get("target_type", "GENERIC"),
            url=row["url"],
            secret_token=row.get("secret_token"),
            events=events,
            is_enabled=bool(row.get("is_enabled", True)),
            last_status_code=row.get("last_status_code"),
            last_error=row.get("last_error"),
            last_dispatched_at=self._ensure_datetime(row.get("last_dispatched_at")),
            created_at=self._ensure_datetime(row.get("created_at")) or datetime.now(timezone.utc),
            updated_at=self._ensure_datetime(row.get("updated_at")) or datetime.now(timezone.utc),
        )

    async def list_webhooks(
        self,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
        is_enabled: bool | None = None,
    ) -> list[WebhookEndpoint]:
        await self._ensure_connection()

        if self._fallback_mode or self.pool is None:
            results = [
                wh for wh in self._memory_webhooks.values()
                if wh.tenant_id == tenant_id
            ]
            if is_enabled is not None:
                results = [wh for wh in results if wh.is_enabled == is_enabled]
            return sorted(results, key=lambda w: w.created_at, reverse=True)

        async with self.pool.acquire() as conn:
            query = "SELECT * FROM webhook_endpoints WHERE tenant_id = $1"
            params: list[Any] = [tenant_id]
            if is_enabled is not None:
                query += " AND is_enabled = $2"
                params.append(is_enabled)
            query += " ORDER BY created_at DESC"

            rows = await conn.fetch(query, *params)
            return [self._row_to_endpoint(dict(r)) for r in rows]

    async def get_webhook(
        self,
        webhook_id: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> WebhookEndpoint | None:
        await self._ensure_connection()

        if self._fallback_mode or self.pool is None:
            wh = self._memory_webhooks.get(webhook_id)
            if wh and wh.tenant_id == tenant_id:
                return wh
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM webhook_endpoints WHERE id = $1 AND tenant_id = $2",
                webhook_id,
                tenant_id,
            )
            return self._row_to_endpoint(dict(row)) if row else None

    async def create_webhook(
        self,
        webhook: WebhookEndpoint,
    ) -> WebhookEndpoint:
        await self._ensure_connection()

        webhook.updated_at = datetime.now(timezone.utc)
        if self._fallback_mode or self.pool is None:
            self._memory_webhooks[webhook.id] = webhook
            return webhook

        created_at_dt = self._ensure_datetime(webhook.created_at) or datetime.now(timezone.utc)
        updated_at_dt = self._ensure_datetime(webhook.updated_at) or datetime.now(timezone.utc)
        last_disp_dt = self._ensure_datetime(webhook.last_dispatched_at)

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO webhook_endpoints (
                    id, tenant_id, name, target_type, url, secret_token, events,
                    is_enabled, last_status_code, last_error, last_dispatched_at, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
                """,
                webhook.id,
                webhook.tenant_id,
                webhook.name,
                webhook.target_type,
                webhook.url,
                webhook.secret_token,
                json.dumps(webhook.events),
                webhook.is_enabled,
                webhook.last_status_code,
                webhook.last_error,
                last_disp_dt,
                created_at_dt,
                updated_at_dt,
            )
        return webhook

    async def update_webhook(
        self,
        webhook: WebhookEndpoint,
    ) -> WebhookEndpoint | None:
        await self._ensure_connection()

        webhook.updated_at = datetime.now(timezone.utc)
        if self._fallback_mode or self.pool is None:
            if webhook.id in self._memory_webhooks:
                self._memory_webhooks[webhook.id] = webhook
                return webhook
            return None

        updated_at_dt = self._ensure_datetime(webhook.updated_at) or datetime.now(timezone.utc)
        last_disp_dt = self._ensure_datetime(webhook.last_dispatched_at)

        async with self.pool.acquire() as conn:
            res = await conn.execute(
                """
                UPDATE webhook_endpoints SET
                    name = $1,
                    target_type = $2,
                    url = $3,
                    secret_token = $4,
                    events = $5::jsonb,
                    is_enabled = $6,
                    last_status_code = $7,
                    last_error = $8,
                    last_dispatched_at = $9,
                    updated_at = $10
                WHERE id = $11 AND tenant_id = $12
                """,
                webhook.name,
                webhook.target_type,
                webhook.url,
                webhook.secret_token,
                json.dumps(webhook.events),
                webhook.is_enabled,
                webhook.last_status_code,
                webhook.last_error,
                last_disp_dt,
                updated_at_dt,
                webhook.id,
                webhook.tenant_id,
            )
            if res == "UPDATE 0":
                return None
        return webhook

    async def delete_webhook(
        self,
        webhook_id: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> bool:
        await self._ensure_connection()

        if self._fallback_mode or self.pool is None:
            if webhook_id in self._memory_webhooks:
                del self._memory_webhooks[webhook_id]
                return True
            return False

        async with self.pool.acquire() as conn:
            res = await conn.execute(
                "DELETE FROM webhook_endpoints WHERE id = $1 AND tenant_id = $2",
                webhook_id,
                tenant_id,
            )
            return res != "DELETE 0"

    async def record_dispatch_result(
        self,
        webhook_id: str,
        tenant_id: str,
        status_code: int | None,
        error: str | None,
    ) -> None:
        await self._ensure_connection()
        now = datetime.now(timezone.utc)
        if self._fallback_mode or self.pool is None:
            wh = self._memory_webhooks.get(webhook_id)
            if wh:
                wh.last_status_code = status_code
                wh.last_error = error
                wh.last_dispatched_at = now
                wh.updated_at = now
            return

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE webhook_endpoints SET
                    last_status_code = $1,
                    last_error = $2,
                    last_dispatched_at = $3,
                    updated_at = $3
                WHERE id = $4 AND tenant_id = $5
                """,
                status_code,
                error,
                now,
                webhook_id,
                tenant_id,
            )
