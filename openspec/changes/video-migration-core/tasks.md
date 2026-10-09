# Tasks: video-migration-core

## Phase 1: Project Scaffolding & Dependencies

- [x] 1.1 Bootstrap backend directory structure (`backend/domain/`, `backend/application/`, `backend/infrastructure/`, `backend/presentation/`).
- [x] 1.2 Configure backend dependencies in `backend/pyproject.toml` (FastAPI latest, Pydantic v2, Telethon, aiosqlite, uvicorn, sse-starlette).
- [x] 1.3 Bootstrap frontend directory with Vite + React 19 + TypeScript in `frontend/`.
- [x] 1.4 Install frontend dependencies in `frontend/package.json` (Tailwind CSS, Zustand, lucide-react, clsx, tailwind-merge).

---

## Phase 2: Backend Domain & Persistence Layers

- [x] 2.1 Define domain entities (`Channel`, `VideoMessage`, `MigrationJob`), status enum (`JobStatus`), and domain exceptions in `backend/domain/entities/`.
- [x] 2.2 Define domain ports (`TelegramGatewayPort`, `JobRepositoryPort`) in `backend/domain/ports/`.
- [x] 2.3 Implement SQLite job repository in `backend/infrastructure/persistence/sqlite_job_repository.py` for checkpoints and idempotency tracking.
- [x] 2.4 Add unit tests for SQLite repository job creation, progress updates, and checkpoint resumption in `backend/tests/`.

---

## Phase 3: Telethon MTProto Gateway & Migration Worker

- [x] 3.1 Implement `TelethonAdapter` in `backend/infrastructure/telegram/telethon_adapter.py` wrapping MTProto client, channel discovery, and reference copying (`send_file`/`InputDocument`).
- [x] 3.2 Implement `CloneChannelVideosUseCase` and worker loop with:
  - Sequential message processing.
  - Safe jitter delay (1.5s - 2.0s).
  - `FloodWaitError` interception and automatic `N + 2` sleep resume.
  - SQLite checkpoint saving per video.
- [x] 3.3 Add unit/mock tests for worker rate limiting and FloodWait recovery in `backend/tests/`.

---

## Phase 4: Backend API & SSE Streaming

- [x] 4.1 Implement in-memory event broadcaster in `backend/application/broadcaster.py` to decouple worker events from SSE clients.
- [x] 4.2 Implement FastAPI routers in `backend/presentation/api/routers/`:
  - `GET /api/channels` (list accessible channels).
  - `POST /api/jobs` (start new migration job).
  - `GET /api/jobs/{job_id}/stream` (SSE event stream).
  - `POST /api/jobs/{job_id}/cancel` (stop active migration).
- [x] 4.3 Configure CORS and FastAPI application entrypoint in `backend/main.py`.

---

## Phase 5: Frontend Feature-First Implementation

- [x] 5.1 Define frontend domain types in `frontend/src/features/migration/domain/types.ts`.
- [x] 5.2 Implement infrastructure API client in `frontend/src/features/migration/infrastructure/migrationApi.ts`.
- [x] 5.3 Implement Zustand store `useMigrationStore` in `frontend/src/features/migration/application/useMigrationStore.ts`.
- [x] 5.4 Implement SSE subscriber hook `useMigrationStream` in `frontend/src/features/migration/application/useMigrationStream.ts`.
- [x] 5.5 Implement UI components in `frontend/src/features/migration/presentation/components/`:
  - `ChannelSelector.tsx` (source & destination cards with search).
  - `ProgressBar.tsx` (progress bar, count, and live speed).
  - `TerminalLog.tsx` (streaming console log of processed items).
  - `ConfirmModal.tsx` (verification before triggering).
- [x] 5.6 Implement `MigrationView.tsx` strictly adhering to the constraint of at most 2 `useState` hooks.
- [x] 5.7 Wire up the application shell in `frontend/src/app/App.tsx`.

---

## Phase 6: Verification & End-to-End Validation

- [x] 6.1 Execute backend unit and integration test suite (`pytest`).
- [x] 6.2 Execute frontend type checking and production build (`tsc && vite build`).
- [x] 6.3 Verify dry-run with mock channels to prove zero downloads, caption preservation, and SSE event flow.
