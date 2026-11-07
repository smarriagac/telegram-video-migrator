# Feature: Recurring Scheduled Broadcast Campaigns

Enable users to schedule broadcast messages (with optional photo/video albums) to multiple Telegram channels and groups, supporting one-time execution and recurring intervals (`EVERY_6_HOURS`, `EVERY_12_HOURS`, `DAILY`, `WEEKLY`), with automated background polling, retry logic, and cancellation.

Delivery strategy: single-pr

## Specs
- S1: Database Entity & Persistence:
  - Add `ScheduledBroadcast` domain entity (`id`, `name`, `target_ids`, `text`, `media_paths`, `account_id`, `scheduled_at`, `recurrence`, `status`, `last_run_at`, `run_count`, `last_error`, `created_at`).
  - Add schema table `scheduled_broadcasts` in SQLite and Postgres.
  - Implement repository methods in `JobRepositoryPort`, `SQLiteJobRepository`, and `PostgresJobRepository`:
    - `create_scheduled_broadcast(broadcast)`
    - `get_scheduled_broadcast(id)`
    - `list_scheduled_broadcasts(status=None)`
    - `update_scheduled_broadcast(broadcast)`
    - `delete_scheduled_broadcast(id)`
- S2: Background Polling Daemon (`BroadcastSchedulerService`):
  - Polls database every 10 seconds for `status='SCHEDULED'` and `scheduled_at <= now()`.
  - Dispatches `gateway.broadcast_message(...)` safely.
  - If `recurrence == 'ONCE'`: marks `COMPLETED`, records `last_run_at=now()`, increments `run_count`.
  - If `recurrence` in (`EVERY_6_HOURS`, `EVERY_12_HOURS`, `DAILY`, `WEEKLY`):
    computes next execution timestamp, sets status back to `SCHEDULED`, updates `last_run_at=now()`, increments `run_count`.
  - Emits audit log `SCHEDULED_BROADCAST_EXECUTED`.
  - Graceful lifecycle `start()` / `stop()` attached to FastAPI app lifespan.
- S3: REST API Endpoints:
  - `POST /api/channels/broadcast/schedule`:
    - Multipart form or JSON payload accepting `target_ids`, `text`, `account_id`, `scheduled_at`, `recurrence`, and optional files.
    - Saves media to persistent storage `data/broadcasts/` so it remains available for recurring runs.
  - `GET /api/channels/broadcast/scheduled`: list all active/past scheduled campaigns.
  - `DELETE /api/channels/broadcast/scheduled/{campaign_id}`: cancel or remove a campaign.
- S4: Frontend UI (`BroadcastMessageModal.tsx` & Channel API):
  - In `channelApi.ts`: methods for scheduling and listing campaigns.
  - In `BroadcastMessageModal.tsx`:
    - Switch: "Programar Envío Recurrente".
    - Date/time selector defaulting to current time + 1 hour.
    - Recurrence selector: `Una vez`, `Cada 6 horas`, `Cada 12 horas`, `Diario`, `Semanal`.
    - Tab / Drawer to view active scheduled campaigns with cancel buttons.
  - Strict constraint: Maintain max 2 `useState` hooks in `BroadcastMessageModal.tsx`.
- S5: Testing & Verification:
  - Automated unit tests for `BroadcastSchedulerService` (recurrence calculation, execution, completion).
  - Backend pytest suite green.
  - Frontend builds with zero TypeScript errors.

## Tasks
- [x] T1 (S1): Define `ScheduledBroadcast` entity and repository schema in SQLite and Postgres [inline]
- [x] T2 (S2): Implement `BroadcastSchedulerService` background daemon [inline]
- [x] T3 (S3): Implement API endpoints for scheduling, listing, and cancelling campaigns in `channels.py` [inline]
- [x] T4 (S5): Write backend automated unit tests in `backend/tests/test_broadcast_scheduler.py` [inline]
- [x] T5 (S4): Add scheduler UI controls to `BroadcastMessageModal.tsx` within 2-hook budget [inline]
- [x] T6 (S5): Build frontend bundle and deploy to Docker containers [inline]
- [x] T7 (S5): Run full pytest test suite [inline]
- [x] T8 (S5): Git commit and push with conventional commit message [inline]

## Log
- L1: User requested both Multi-Account Failover (completed) and Recurring Scheduled Broadcast Campaigns. Initialized ODD task specification.
- L2: Defined `ScheduledBroadcast` entity, added schema migrations for `scheduled_broadcasts` in SQLite and Postgres repositories with full CRUD methods.
- L3: Implemented `BroadcastSchedulerService` background polling daemon handling single and recurring intervals (`EVERY_6_HOURS`, `EVERY_12_HOURS`, `DAILY`, `WEEKLY`).
- L4: Added `/api/channels/broadcast/schedule` and management endpoints with persistent media storage and audit logging in `channels.py`.
- L5: Added unit tests in `backend/tests/test_broadcast_scheduler.py` verifying CRUD, one-time completion, recurrence advancing, and future filtering.
- L6: Added scheduler and recurrence controls, datetime picker, and scheduled campaigns tab in `BroadcastMessageModal.tsx` adhering to the 2-hook budget.
- L7: Built frontend bundle and deployed to `telegram_migrator_frontend`. Recreated backend service lifecycle.
