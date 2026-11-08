# Task: Dead-Letter Queue (DLQ) & Granular Item Retry Engine (ODD Spec)

## Context & Objectives
When high-volume channel migration jobs run, individual posts or videos may fail due to temporary network glitches, file size exceeding Telegram limits (>2GB/4GB), FloodWait rate limits, or malformed captions.
Currently:
1. Operators can only retry **all** failed items at once via `POST /api/jobs/{id}/retry`. There is no way to retry a specific post, nor skip a permanently broken video that blocks job completion.
2. Failed items are isolated inside each job. Operators must click into every individual job modal to identify what failed.

This task implements a full **Dead-Letter Queue (DLQ) & Granular Item Retry Engine**:
1. **Repository & Domain Methods**:
   - `retry_single_queue_item(job_id: str, source_msg_id: int) -> bool`: Resets status from `FAILED` to `PENDING`, increments retry count, and clears error message.
   - `skip_queue_item(job_id: str, source_msg_id: int) -> bool`: Marks an item as `SKIPPED` with a note so it stops blocking the job.
   - `update_queue_item_caption(job_id: str, source_msg_id: int, caption: str) -> bool`: Allows editing caption before re-running.
   - `list_dead_letter_items(limit: int, offset: int, job_id: str | None) -> tuple[list[QueueItem], int]`: Aggregated cross-job query of all failed items.
2. **REST API**:
   - `GET /api/jobs/dlq`: List dead-letter queue items with pagination and stats.
   - `POST /api/jobs/{job_id}/queue/{source_msg_id}/retry`: Granularly retry a single failed post and resume worker if needed.
   - `POST /api/jobs/{job_id}/queue/{source_msg_id}/skip`: Mark a failed post as skipped.
   - `PATCH /api/jobs/{job_id}/queue/{source_msg_id}`: Edit caption/metadata for a queue item.
3. **Frontend UI Integration**:
   - Unified **Dead-Letter Queue (DLQ)** view tab in [`JobsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/JobsView.tsx) (`"migrations" | "ffmpeg" | "dlq"`).
   - In [`JobQueueModal.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/components/JobQueueModal.tsx), inline action buttons per row (`[Reintentar]`, `[Omitir]`).
   - Modal or dialog to edit caption before retrying.
   - Adhere strictly to `<= 2 useState` hooks per component.
4. **Automated Verification**:
   - Backend pytest suite for single-item retry, skipping, caption updating, and DLQ listing.
   - Frontend Vitest suite for DLQ table rendering, single-item retry click, and skip action.

## Implementation & Verification Status: COMPLETED

### Backend
- Domain Port: [`JobRepositoryPort`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/ports/job_repository_port.py) extended with `retry_single_queue_item`, `skip_queue_item`, `update_queue_item_caption`, `list_dead_letter_items`.
- SQLite Persistence: [`SqliteJobRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/sqlite_job_repository.py) fully implemented with transactions and pagination.
- PostgreSQL Persistence: [`PostgresJobRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/postgres_job_repository.py) fully implemented with connection pooling and schema fallbacks.
- API Router: [`backend/presentation/api/routers/jobs.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/jobs.py) exposed `GET /api/jobs/dlq`, `POST /{job_id}/queue/{source_msg_id}/retry`, `POST /{job_id}/queue/{source_msg_id}/skip`, and `PATCH /{job_id}/queue/{source_msg_id}`.
- Automated tests: `backend/tests/test_migration_queue.py` passing 3/3; full backend suite passing 177/177.

### Frontend
- API Client: [`jobsApi.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/infrastructure/jobsApi.ts) updated with `fetchDLQ`, `retrySingleItem`, `skipSingleItem`, and `updateItemCaption`.
- Dead-Letter Queue Card: [`DeadLetterQueueCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/components/DeadLetterQueueCard.tsx) with table, retry, skip, and caption edit dialog (strictly 2 `useState` hooks).
- Job Queue Modal: [`JobQueueModal.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/components/JobQueueModal.tsx) with granular retry per row (strictly 2 `useState` hooks).
- Tab Integration: [`JobsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/JobsView.tsx) with tab `"migrations" | "ffmpeg" | "dlq"` (strictly 2 `useState` hooks).
- Vitest tests: [`DeadLetterQueueCard.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/__tests__/DeadLetterQueueCard.test.tsx) passing 5/5; full frontend suite passing 38/38 across 12 files.
- Production build: `tsc -b && vite build` passing cleanly with 0 errors. Live deployment to `telegram_migrator_frontend` verified.

