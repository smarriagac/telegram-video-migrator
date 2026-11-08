# Task: Bulk Operations & Batch Management in Dead-Letter Queue (DLQ) (ODD Spec)

## Context & Objectives
The Dead-Letter Queue (DLQ) allows inspecting failed posts across all migration jobs.
However, when network disruptions, rate limits, or batch failures occur, dozens or hundreds of items can enter the DLQ. Retrying or skipping them one by one is slow and error-prone.

This task implements **Bulk Operations in DLQ**:
1. **Repository & Domain Methods**:
   - `retry_bulk_queue_items(items: list[tuple[str, int]]) -> int`: Atomically resets multiple items from `FAILED` to `PENDING` across SQLite and PostgreSQL.
   - `skip_bulk_queue_items(items: list[tuple[str, int]]) -> int`: Atomically marks multiple items as `SKIPPED`.
2. **REST API**:
   - `POST /api/jobs/dlq/bulk-retry`: Accepts a list of `(job_id, source_message_id)` pairs, resets them to `PENDING`, increments retry count, and automatically resumes any inactive or paused parent jobs.
   - `POST /api/jobs/dlq/bulk-skip`: Accepts a list of `(job_id, source_message_id)` pairs and marks them as `SKIPPED`.
3. **Frontend UI**:
   - Add master and row-level checkboxes to [`DeadLetterQueueCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/components/DeadLetterQueueCard.tsx).
   - Display a contextual Bulk Action Toolbar when items are selected (`[Reintentar Seleccionados]`, `[Omitir Seleccionados]`, `[Deseleccionar]`).
   - Strictly adhere to $\le 2$ `useState` hooks.
4. **Automated Verification**:
   - Backend tests in `backend/tests/test_migration_queue.py`.
   - Frontend Vitest tests in `frontend/src/features/jobs/presentation/__tests__/DeadLetterQueueCard.test.tsx`.

## Implementation & Verification Status: COMPLETED

### Backend
- Domain Port: [`JobRepositoryPort`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/ports/job_repository_port.py) extended with `retry_bulk_queue_items` and `skip_bulk_queue_items`.
- SQLite Persistence: [`SqliteJobRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/sqlite_job_repository.py) implemented with transactional batch updates.
- PostgreSQL Persistence: [`PostgresJobRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/postgres_job_repository.py) implemented with transactional connection pooling.
- REST Router: Added `POST /api/jobs/dlq/bulk-retry` and `POST /api/jobs/dlq/bulk-skip` in [`jobs.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/jobs.py) (positioned before `/{job_id}` to prevent route interception).
- Pytest Suite: 5/5 passing in `test_migration_queue.py`.

### Frontend
- API Client: Added `bulkRetryDLQ` and `bulkSkipDLQ` in [`jobsApi.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/infrastructure/jobsApi.ts).
- UI Component: [`DeadLetterQueueCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/components/DeadLetterQueueCard.tsx) with master and row-level checkboxes, contextual bulk actions toolbar (`[Reintentar Seleccionados]`, `[Omitir]`, `[Deseleccionar]`), and reactive updates (strictly $\le 2$ `useState` hooks).
- Vitest Suite: 7/7 passing in [`DeadLetterQueueCard.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/__tests__/DeadLetterQueueCard.test.tsx) and 45/45 passing across all 13 test files.
- Production Build: `tsc -b && vite build` clean with 0 errors. Deployed to live Docker container.

