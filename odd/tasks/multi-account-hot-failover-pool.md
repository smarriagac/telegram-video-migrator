# ODD Task: Multi-Account Hot-Failover & FloodWait Load Balancer

## Status: COMPLETED
**Assigned**: Senior Architect
**Scope**: Dynamic MTProto account hot-rotation upon FloodWait, zero-pause migration continuity, client pool availability checks, failover telemetry and event broadcasting, and frontend indicators in Jobs and Rate Governor cards ($\le 2$ `useState`).

---

## 1. Problem & Context
During bulk migrations or high-throughput channel cloning, Telegram frequently enforces `FloodWait` (ranging from 30s to several minutes) on active MTProto sessions.
Currently:
1. When a `FloodWaitDomainException` occurs, the worker pauses the entire job, sets status `PAUSED_FLOOD_WAIT`, and sleeps synchronously for the duration.
2. Even if the tenant has multiple active, authorized Telegram accounts connected in [`TelegramClientPool`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/telegram/telegram_client_pool.py), the migration cannot capitalize on healthy alternative sessions.
3. Jobs suffer long, unnecessary delays when redundant MTProto capacity is available.

---

## 2. Technical Architecture & Design

### 2.1 Hot-Rotation Gateway & Pool Coordination
- In [`TelegramGatewayPort`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/ports/telegram_gateway_port.py) and [`TelethonAdapter`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/telegram/telethon_adapter.py):
  - Add `rotate_account_on_flood_wait(account_id: int | None, flood_wait_seconds: int, tenant_id: str | None = None) -> tuple[int, str] | None`.
  - Marks current `account_id` in cooldown in [`TelegramClientPool`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/telegram/telegram_client_pool.py) and queries `get_available_client(tenant_id, exclude_account_id)`.
  - Returns `(new_account_id, new_account_name)` or `None`.

### 2.2 Seamless Failover in Migration Pipeline
- In [`CloneChannelVideosUseCase`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/use_cases/clone_channel_videos_use_case.py):
  - When `FloodWaitDomainException` is caught:
    1. Report feedback to `RateGovernorService`.
    2. Attempt hot-rotation via `gateway.rotate_account_on_flood_wait`.
    3. If rotated:
       - Update active target/source account to `new_account_id`.
       - Increment `failover_count`.
       - Persist via `repo.update_job_failover(job_id, new_account_id, failover_count)`.
       - Emit real-time failover progress event without pausing the job.
       - Continue migration immediately.
    4. If no alternative account is available (or single account):
       - Fallback to graceful cooldown pause as before.

### 2.3 Persistence & Job Telemetry
- Update [`MigrationJob`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/entities/migration_job.py):
  - Add `failover_count: int = 0`.
- Update [`JobRepositoryPort`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/ports/job_repository_port.py), [`SqliteJobRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/sqlite_job_repository.py), and [`PostgresJobRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/postgres_job_repository.py):
  - Add column `failover_count` to `migration_jobs`.
  - Implement `update_job_failover(job_id, new_account_id, failover_count)`.

### 2.4 Presentation & UI
- REST API: Include `failover_count` and `active_account_id` in `JobResponse`.
- Frontend:
  - Display failover badge in [`JobsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/JobsView.tsx) and [`JobQueueModal.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/components/JobQueueModal.tsx).
  - Update domain types in `types.ts`.

---

## 3. Verification & Results
1. Integration and persistence tests in [`test_migration_queue.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/tests/test_migration_queue.py):
   - `test_job_failover_persistence`: Passed.
   - `test_use_case_hot_failover_on_flood_wait`: Passed.
   - Full suite: 206 passed.
2. Frontend unit tests in [`JobQueueModal.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/__tests__/JobQueueModal.test.tsx):
   - Full suite: 58 passed.
3. Production build `npm run build`: Succeeded without TypeScript warnings.
4. Container deployment and curl verification: Verified `failover_count: 0` in live API responses.
