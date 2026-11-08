# Task: Multichannel Webhook & Operational Alert Dispatcher (ODD Spec)

## Context & Objectives
Administrators need instant real-time alerts across multiple communication channels when operational events happen (e.g., Telegram FloodWait rate limits, automated backup snapshots created, channel access eviction, or recurring migration job failures). 
Currently, the system only supports MTProto direct messages. This task expands the alerting system into an enterprise-grade **Multichannel Webhook & Alert Dispatcher**:
1. **Multi-Target Dispatching**:
   - **Discord Webhook**: POST formatted embeds with severity colors (INFO = Green, WARNING = Yellow/Amber, ERROR/CRITICAL = Red), metadata fields, and timestamps.
   - **Slack Webhook**: POST structured Slack Incoming Webhook blocks and attachments.
   - **Telegram Bot / MTProto**: Bot token + chat_id or MTProto direct message.
   - **Generic HTTP Webhook**: POST JSON payloads with HMAC-SHA256 signature header (`X-Hub-Signature-256`) and event type (`X-Hub-Event`).
2. **Resilience & Reliability**:
   - Non-blocking async dispatching with retries (up to 3 attempts with exponential backoff: 1s, 2s).
   - Delivery tracking: record `last_status_code`, `last_error`, and `last_dispatched_at` on each endpoint.
   - Event subscription filtering per webhook: `["job.failed", "flood_wait", "backup.created", "channel.eviction"]`.
3. **Domain Model & Persistence**:
   - Entity [`WebhookEndpoint`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/entities/webhook_endpoint.py).
   - Port [`WebhookRepositoryPort`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/ports/webhook_repository_port.py).
   - Adapter [`PostgresWebhookRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/postgres_webhook_repository.py) with PostgreSQL schema `webhook_endpoints` and SQLite in-memory fallback.
   - Automatic inclusion in [`DisasterRecoveryService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/disaster_recovery_service.py).
4. **REST API**:
   - `GET /api/webhooks`: List endpoints for current tenant.
   - `POST /api/webhooks`: Register new endpoint.
   - `GET /api/webhooks/{id}`: Endpoint details.
   - `PUT /api/webhooks/{id}`: Update endpoint.
   - `DELETE /api/webhooks/{id}`: Remove endpoint.
   - `POST /api/webhooks/{id}/test`: Trigger live test ping with realistic payload and return status code, response time, and error (if any).
5. **Frontend Management Console**:
   - Card [`WebhookManagerCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/components/WebhookManagerCard.tsx) adhering strictly to `<= 2 useState` hooks.
   - API client [`webhooksApi.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/infrastructure/webhooksApi.ts).
   - Embedded inside `SettingsView.tsx` under the Alerts tab.
   - Quick "Probar Webhook" button with instant status feedback.
6. **Automated Verification**:
   - Backend pytest suite covering payload formatters (Discord, Slack, Generic), retry loop, and repository CRUD.
   - Frontend Vitest suite testing webhook listing, creation, and test ping trigger.


## Implementation & Verification Summary
- **Backend Architecture**:
  - Entity: [`WebhookEndpoint`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/entities/webhook_endpoint.py)
  - Port: [`WebhookRepositoryPort`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/ports/webhook_repository_port.py)
  - Persistence: [`PostgresWebhookRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/postgres_webhook_repository.py) with automatic connection loop recovery and database backup inclusion in [`DisasterRecoveryService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/disaster_recovery_service.py).
  - Dispatcher Service: [`WebhookDispatcherService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/webhook_dispatcher_service.py) supporting Discord embeds with severity colors, Slack blocks, Telegram Bot messages, and generic HTTP with HMAC-SHA256 signature verification.
  - Alert Integration: [`AlertingService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/alerting_service.py) automatically broadcasts FloodWait, Job Failures, Backups, and Evictions to all subscribed webhooks concurrently.
  - API Router: [`backend/presentation/api/routers/webhooks.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/webhooks.py) with CRUD and `/test` + `/test-url` endpoints.
  - Backend Tests: [`backend/tests/test_webhooks.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/tests/test_webhooks.py) (**175/175 tests passing** across entire backend suite).
- **Frontend Architecture**:
  - API Client: [`webhooksApi.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/infrastructure/webhooksApi.ts)
  - Management Card: [`WebhookManagerCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/components/WebhookManagerCard.tsx) (Strictly 2 `useState` hooks)
  - View Integration: Embedded in [`SettingsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/SettingsView.tsx) under the Alertas Operativas tab.
  - Frontend Tests: [`WebhookManagerCard.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/__tests__/WebhookManagerCard.test.tsx) (**11 test files, 33/33 tests passing**).
  - Production Bundle: Verified with Vite and deployed to `telegram_migrator_frontend`.
