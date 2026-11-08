# Feature: Telegram Operational Push Alerting Daemon

Connect `AlertingService` with `LiveSyncService` and `BroadcastSchedulerService` to automatically dispatch instant direct messages (DM) or channel alerts to the platform administrator (e.g. `@Smpyt`) whenever critical operational events occur (e.g. channel evictions with `ACCESS_REVOKED`, broadcast campaign execution failures, or FloodWait throttling).

Delivery strategy: single-pr

## Specs
- S1: Alert Configuration & Dynamic Recipient Resolution:
  - Enhance `AlertingService` to automatically resolve tenant/admin alert preferences (`alert_recipient`, `alert_channel_id`, `notify_evictions`, `notify_job_failures`, `notify_flood_wait`) from settings/audit repository, with fallback to environment variables (`ALERT_TELEGRAM_RECIPIENT` / `@Smpyt`).
  - Safe error handling: alerting failures must never throw or break core background daemons.
- S2: Live Sync Eviction Hook (`LiveSyncService`):
  - When `LiveSyncService` catches a Telegram expulsion (`ChannelPrivateError`, `UserBannedInChannelError`, missing input entity) transitioning a binding to `ACCESS_REVOKED`, immediately trigger an alert to the administrator via `AlertingService`.
- S3: Broadcast Failure Hook (`BroadcastSchedulerService`):
  - When a scheduled or recurring broadcast encounters an unhandled exception or high failure count, trigger an operational alert via `AlertingService`.
- S4: Dependency Injection Wiring:
  - In `backend/presentation/dependencies.py`: inject `AlertingService` into `LiveSyncService` and `BroadcastSchedulerService`.
- S5: Testing & Verification:
  - Add comprehensive automated tests in `backend/tests/test_alerting_service.py` verifying eviction alerts, broadcast failure alerts, and graceful fallback.
  - Run full backend test suite to ensure 100% passing tests.

## Tasks
- [x] T1 (S1): Enhance `AlertingService` with config resolver and safe dispatching [inline]
- [x] T2 (S2): Wire eviction alerts into `LiveSyncService` on `ACCESS_REVOKED` [inline]
- [x] T3 (S3): Wire failure alerts into `BroadcastSchedulerService` [inline]
- [x] T4 (S4): Update dependency injection in `backend/presentation/dependencies.py` [inline]
- [x] T5 (S5): Write automated unit tests in `backend/tests/test_alerting_service.py` [inline]
- [x] T6 (S5): Run full pytest test suite [inline]
- [x] T7 (S5): Git commit and push with conventional commit message [inline]

## Log
- L1: User authorized Phase 1 of operational hardening: push alerts to Telegram admin on critical events. Initialized ODD task specification in `odd/tasks/telegram-operational-alerting-daemon.md`.
- L2: Enhanced `AlertingService` with `get_alert_config`, `notify_channel_eviction`, `notify_broadcast_failure`, and `notify_flood_wait`.
- L3: Connected eviction notifications to `LiveSyncService` during catch-up delta and manual verification.
- L4: Connected failure notifications to `BroadcastSchedulerService` during campaign dispatching.
- L5: Wired dependencies in `dependencies.py` injecting `AlertingService` with postgres repo.
- L6: Created unit test suite in `backend/tests/test_alerting_service.py` (124/124 backend tests passing).
- L7: Verified zero regressions and restarted container.
