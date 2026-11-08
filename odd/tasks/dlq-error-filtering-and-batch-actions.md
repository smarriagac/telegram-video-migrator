# Task: DLQ Advanced Error Filtering & 1-Click Batch Actions

## Context & Motivation
In large channel migrations, failed items in the Dead-Letter Queue (DLQ) arise from distinct root causes:
1. Transient rate-limiting (`FloodWait`): Resolved automatically by waiting out backoff or rotating accounts.
2. Network timeouts (`TimeoutError`, connection reset): Resolved by instant retry.
3. Access/Permissions errors (`ChannelPrivate`, `ChatAdminRequired`, `UserBannedInChannel`): Require manual admin rights or target channel configuration.
4. Media transcoding / corruption (`FFmpeg`, unrecognized codecs): Require caption sanitization or skipping.

Operators currently have to inspect each item or select items individually. Providing **semantic error categorisation** and **1-click batch actions** allows operators to recover hundreds of transient items in a single click (e.g. *"Reintentar todos los 42 errores de FloodWait"*).

---

## Architecture & Scope

### 1. Domain & Persistence (`JobRepositoryPort`)
- Update `list_dead_letter_items`:
  - Parameters: `limit`, `offset`, `job_id`, `error_category`, `media_type`, `search`.
- Add `get_dead_letter_summary(job_id: str | None = None) -> dict[str, Any]`:
  - Returns aggregation of failed items grouped by `error_category` and `media_type`.
- Add `retry_filtered_queue_items(error_category, media_type, job_id, search) -> tuple[int, list[str]]`:
  - Atomically sets matching failed items back to `PENDING` and returns list of affected `job_id`s.
- Add `skip_filtered_queue_items(error_category, media_type, job_id, search) -> int`:
  - Atomically marks matching failed items as `SKIPPED`.
- Persistence implementations in `SqliteJobRepository` and `PostgresJobRepository`.

### 2. Presentation Layer (`backend/presentation/api/routers/jobs.py`)
- `GET /api/jobs/dlq`: Updated with query params `error_category`, `media_type`, `search`.
- `GET /api/jobs/dlq/summary`: Returns counts by error category and media type.
- `POST /api/jobs/dlq/retry-by-filter`: Triggers 1-click retry for all matching items and resumes affected jobs.
- `POST /api/jobs/dlq/skip-by-filter`: Triggers 1-click skip for all matching items.

### 3. Frontend Architecture
- API Client in `frontend/src/features/jobs/infrastructure/jobsApi.ts`.
- Component in `frontend/src/features/jobs/presentation/components/DeadLetterQueueCard.tsx`:
  - Constraint: Strictly $\le 2$ `useState` hooks.
  - Category pill filter badges with counters (`Todos`, `FloodWait`, `Network / Timeout`, `Permisos`, `Multimedia`).
  - Contextual 1-click action buttons (`Reintentar todos los FloodWait`, `Omitir todos`).
  - Search bar and media type select.

---

## Verification Criteria
1. Unit tests in backend (`test_migration_queue.py` / `test_dlq_filtering.py`) verifying filtered queries, summary aggregations, and 1-click batch retries.
2. Frontend unit tests in `DeadLetterQueueCard.test.tsx` verifying filter pills, search input, and 1-click actions.
3. Clean TypeScript build and full test suites passing.
4. Live Docker container deployment.
