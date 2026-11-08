# ODD Task: Automated Webhook Retry Engine & Delivery Dead-Letter Dispatcher

## Status: COMPLETED
**Assigned**: Senior Architect
**Completed At**: 2026-11-08
**Verification**: Backend tests (8/8 in test_webhooks.py, 198/198 suite), Frontend tests (6/6 in WebhookManagerCard.test.tsx, 55/55 suite), production build, live deployment, and live curl verification on port 7901.

---

## 1. Context & Motivation
Outbound webhook notifications (for events like `job.failed`, `flood_wait`, `backup.created`, `channel.eviction`) are currently dispatched with immediate in-flight retries. When destination endpoints (Discord, Slack, or generic HTTP servers) suffer temporary network flaps, DNS glitches, or downstream downtime exceeding the immediate retry window, the notification payload is permanently lost.

To guarantee delivery and operational observability, we need:
1. **Persistent Delivery Queue**: Every failed webhook delivery attempt is recorded with full payload context and metadata.
2. **Exponential Backoff Retry Engine**: Background worker that processes pending webhook deliveries with progressive delays ($30\text{s} \times 2^{\text{attempts}}$) up to a max retry limit.
3. **Dead-Letter Queue (DLQ)**: Deliveries that exhaust retries transition to DLQ state for operator inspection.
4. **Remediation & 1-Click Re-dispatch**: Operator ability to trigger immediate redelivery for single items or batch redelivery for all DLQ items.
5. **Observability & UI**: Summary counters and an interactive delivery ledger within the settings/webhooks view ($\le 2$ `useState` constraint).

---

## 2. Architecture & Components

### 2.1 Domain Layer
- **Entity: `WebhookDelivery`** ([`backend/domain/entities/webhook_delivery.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/entities/webhook_delivery.py)):
  - `id`: UUID string.
  - `webhook_id`: Target webhook endpoint ID.
  - `tenant_id`: Multi-tenant boundary.
  - `event_type`: Subscribed event identifier (e.g. `job.failed`).
  - `payload`: Formatted JSON payload dictionary.
  - `url`: Destination URL at time of dispatch.
  - `status`: `PENDING` | `DELIVERED` | `FAILED` | `DLQ`.
  - `attempts`: Integer count of dispatch attempts.
  - `max_attempts`: Default 5.
  - `next_retry_at`: Datetime timestamp with timezone.
  - `last_status_code`: HTTP response code or None.
  - `last_error`: Diagnostic error string or None.
  - `created_at`, `updated_at`: ISO timestamps.

- **Port: `WebhookRepositoryPort`** ([`backend/domain/ports/webhook_repository_port.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/ports/webhook_repository_port.py)):
  - `create_delivery(delivery: WebhookDelivery) -> WebhookDelivery`
  - `get_delivery(delivery_id: str, tenant_id: str) -> WebhookDelivery | None`
  - `update_delivery(delivery: WebhookDelivery) -> WebhookDelivery | None`
  - `list_deliveries(tenant_id: str, webhook_id: str | None = None, status: str | None = None, limit: int = 50, offset: int = 0) -> tuple[list[WebhookDelivery], int]`
  - `get_pending_retries(limit: int = 20) -> list[WebhookDelivery]`
  - `get_dlq_summary(tenant_id: str) -> dict[str, Any]`
  - `delete_delivery(delivery_id: str, tenant_id: str) -> bool`

### 2.2 Persistence Layer
- **`PostgresWebhookRepository`** ([`backend/infrastructure/persistence/postgres_webhook_repository.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/postgres_webhook_repository.py)):
  - PostgreSQL table `webhook_deliveries` with index on `(status, next_retry_at)` and `tenant_id`.
  - In-memory collection fallback for local / non-Postgres testing environments.

### 2.3 Application Layer
- **`WebhookDispatcherService`** ([`backend/application/services/webhook_dispatcher_service.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/webhook_dispatcher_service.py)):
  - Enqueue failed deliveries to `webhook_deliveries` table when initial attempts fail.
  - Re-dispatch method for existing delivery entities.
- **`WebhookRetryEngine`** ([`backend/application/services/webhook_retry_engine.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/webhook_retry_engine.py)):
  - Background async runner / polling task `process_pending_retries()`.
  - Exponential backoff calculation: $\min(30 \times 2^{\text{attempts}}, 3600)$.

### 2.4 Presentation Layer (API & UI)
- **FastAPI Endpoints** ([`backend/presentation/api/routers/webhooks.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/webhooks.py)):
  - `GET /api/webhooks/deliveries`: List audit trail with status/pagination filters.
  - `GET /api/webhooks/deliveries/summary`: Counter metrics (DLQ count, pending retries, delivered total).
  - `POST /api/webhooks/deliveries/{id}/retry`: Re-dispatch single delivery.
  - `POST /api/webhooks/deliveries/dlq/retry-all`: Batch re-dispatch all DLQ items.
  - `DELETE /api/webhooks/deliveries/{id}`: Dismiss DLQ item.
- **Frontend** ([`frontend/src/features/settings`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings)):
  - `webhooksApi.ts`: Client methods for deliveries and DLQ.
  - `WebhookManagerCard.tsx`: Tabbed view for Webhooks Config vs. Delivery DLQ & Audit Ledger, 1-click batch retry, and status badges, keeping $\le 2$ `useState` hooks.

---

## 3. Verification Plan
1. Backend tests for `WebhookDelivery`, retry backoff calculation, and repository persistence.
2. Endpoint integration tests for listing, retrying single delivery, and batch retry-all.
3. Frontend unit tests for `WebhookManagerCard` rendering deliveries, DLQ badges, and triggering retries.
4. Full build (`npm run build`), container deployment, and live curl verification.
