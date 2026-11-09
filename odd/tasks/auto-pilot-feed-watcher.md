# Feature: Auto-Pilot Feed Watcher

Autonomous background daemon that periodically monitors remote creator feeds (TikTok, YouTube Shorts, Instagram), detects newly published videos, runs the automated processing pipeline (9:16 vertical crop/blur, kinetic subtitles, 60s story slicer, smart thumbnails), and stages them directly into Telegram channels or the Content Reservoir without human intervention.

Delivery strategy: single-pr

## Specs
- S1: Feed Watcher Entity & Repository (`FeedSource` & `FeedSourceRepository`):
  - In `backend/domain/entities/feed_source.py`:
    - Entity `FeedSource` with `id`, `tenant_id`, `target_channel_id`, `source_url`, `platform`, `check_interval_minutes`, `is_active`, `pipeline_config`, `last_checked_at`, `last_video_id`, `created_at`.
  - In `backend/infrastructure/persistence/sqlite_job_repository.py` and postgres equivalent:
    - Table `feed_sources` with schema migration and CRUD operations (`create`, `list_active`, `get`, `update_last_check`, `delete`).
- S2: Feed Watcher Daemon & Service (`FeedWatcherService`):
  - In `backend/application/services/feed_watcher_service.py`:
    - `poll_source(source: FeedSource) -> list[dict[str, Any]]`: extracts latest video items via `yt-dlp` (flat inspection), detects uningested videos, passes them through `MediaIngestionService.ingest(...)` with the source's `pipeline_config`, and records state.
    - `run_due_checks() -> int`: scans all due feed sources and executes polling.
- S3: REST API Router:
  - In `backend/presentation/api/routers/feed_watcher.py`:
    - `POST /api/feeds`: register feed source.
    - `GET /api/feeds`: list monitored feeds.
    - `POST /api/feeds/{feed_id}/check-now`: trigger immediate manual poll.
    - `PATCH /api/feeds/{feed_id}/toggle`: toggle active state.
    - `DELETE /api/feeds/{feed_id}`: remove feed source.
- S4: Frontend UI:
  - Component `FeedWatcherModal.tsx` in `frontend/src/features/migration/presentation/components/FeedWatcherModal.tsx`.
  - API client `feedWatcherApi.ts` in `frontend/src/features/migration/infrastructure/feedWatcherApi.ts`.
  - Add "Piloto Automático (Feeds)" trigger button in `ChatsView.tsx` toolbar.
  - Strictly maintain $\le 2$ `useState` hooks per component.
- S5: Testing & Verification:
  - Unit and integration tests in `backend/tests/test_feed_watcher.py`.
  - Full backend pytest suite passing.
  - Frontend Vitest suite passing and Vite build passing.
  - Container deployment and live API verification.
  - Conventional commit and push.

## Tasks
- [x] T1 (S1): Implement `FeedSource` entity and persistence repository [inline]
- [x] T2 (S2): Implement `FeedWatcherService` with flat extraction, deduplication, and ingestion dispatch [inline]
- [x] T3 (S3): Expose REST API endpoints in `feed_watcher.py` router [inline]
- [x] T4 (S5): Write backend automated unit and integration tests in `backend/tests/test_feed_watcher.py` [inline]
- [x] T5 (S4): Implement `feedWatcherApi.ts`, `FeedWatcherModal.tsx`, and toolbar trigger [inline]
- [x] T6 (S5): Run Vitest tests and production build [inline]
- [x] T7 (S5): Deploy to Docker containers and test live endpoints [inline]
- [x] T8 (S5): Mark ODD tasks completed, commit and push [inline]

## Log
- L1: Initialized ODD task for Auto-Pilot Feed Watcher.
- L2: Implemented domain entity `FeedSource` and database schema + CRUD methods in SQLite and Postgres repositories.
- L3: Developed `FeedWatcherService` using `yt-dlp` flat inspection and deduplication logic against `MediaIngestionService`.
- L4: Mounted `/api/feeds` REST router in FastAPI app.
- L5: Verified automated backend test suite with 4 passing tests in `backend/tests/test_feed_watcher.py`.
- L6: Created `FeedWatcherModal.tsx` adhering to the strict <= 2 `useState` hooks constraint.
- L7: Mounted "Auto-Pilot Feeds" trigger button in `ChatsView.tsx` header toolbar.
- L8: Passed full frontend Vitest suite (19 test files, 68 tests) and production Vite build.
- L9: Deployed to live Docker containers and verified live API endpoints (POST, GET, DELETE /api/feeds).
