# Technical Design: video-migration-core

## 1. System Architecture Overview

The system is split into two decoupled sub-projects:
- **Backend**: Python 3.12+ / FastAPI (latest, Pydantic v2) following strict **Clean Architecture** (Uncle Bob).
- **Frontend**: React 19 / TypeScript / Vite / Tailwind CSS following **Feature-First Clean Architecture** with **Zustand**.

```
+-------------------------------------------------------------+
|                     Frontend (React 19)                    |
|  features/migration/presentation/MigrationView (<= 2 useState)
|                           |                                 |
|  features/migration/application/useMigrationStore (Zustand) |
|                           | (SSE + REST)                    |
+---------------------------+---------------------------------+
                            |
+---------------------------v---------------------------------+
|                     Backend (FastAPI)                       |
|  presentation/api/routers (FastAPI endpoints)               |
|                           |                                 |
|  application/use_cases/CloneChannelVideosUseCase            |
|              /            \                                 |
|             v              v                                |
| domain/ports/TelegramPort  domain/ports/JobRepoPort         |
|             ^              ^                                |
|             |              |                                |
| infrastructure/telethon    infrastructure/persistence       |
|    TelethonAdapter             SQLiteJobRepository          |
+-------------------------------------------------------------+
```

---

## 2. Backend Design (Clean Architecture)

### 2.1 Domain Layer (`backend/domain/`)
Pure Python, zero external framework dependencies (no FastAPI, no Telethon, no SQL libraries).

- **Entities**:
  - `Channel`: `id: int`, `title: str`, `username: str | None`, `can_post: bool`.
  - `VideoMessage`: `message_id: int`, `input_document_id: int`, `access_hash: int`, `file_reference: bytes`, `caption: str`, `entities: list[dict]`.
  - `MigrationJob`: `job_id: str`, `source_id: int`, `target_id: int`, `status: JobStatus`, `total_videos: int`, `processed_videos: int`, `last_processed_id: int`.
- **Value Objects / Enums**:
  - `JobStatus`: `PENDING`, `RUNNING`, `PAUSED_FLOOD_WAIT`, `COMPLETED`, `FAILED`, `CANCELLED`.
- **Ports (Abstract Base Classes)**:
  - `TelegramGatewayPort`:
    - `async def get_managed_channels() -> list[Channel]`
    - `async def fetch_channel_videos(channel_id: int, after_message_id: int | None = None) -> list[VideoMessage]`
    - `async def copy_video_by_reference(target_channel_id: int, video: VideoMessage) -> int` (returns created message_id)
  - `JobRepositoryPort`:
    - `async def create_job(job: MigrationJob) -> None`
    - `async def update_job_progress(job_id: str, processed_count: int, last_msg_id: int) -> None`
    - `async def set_job_status(job_id: str, status: JobStatus) -> None`
    - `async def get_job(job_id: str) -> MigrationJob | None`

### 2.2 Application Layer (`backend/application/`)
Orchestrates business logic and use cases without web/infrastructure ties.

- **Use Cases**:
  - `GetManagedChannelsUseCase`: Queries `TelegramGatewayPort` for channels.
  - `StartMigrationJobUseCase`: Initializes a `MigrationJob`, writes initial state to `JobRepositoryPort`, and triggers the background task.
  - `CloneChannelVideosWorker`:
    1. Fetches all videos from source channel.
    2. Queries repository for `last_processed_id` to skip already copied items (idempotency).
    3. Iterates through video queue:
       - Calls `copy_video_by_reference`.
       - Emits progress event via internal async queue/broadcaster.
       - Sleeps for random jitter: `1.5s` to `2.0s`.
       - Catches `FloodWaitError`: emits `PAUSED_FLOOD_WAIT`, sleeps `N + 2` seconds, then retries.
       - Records progress in SQLite repository.

### 2.3 Infrastructure Layer (`backend/infrastructure/`)
- `TelethonAdapter` (implements `TelegramGatewayPort`):
  - Wraps `telethon.TelegramClient`.
  - Uses `client.send_file(entity, file=message.media, caption=message.message, formatting_entities=message.entities)`.
  - Translates Telethon exceptions into domain exceptions (`FloodWaitDomainException`, `ChannelAccessDeniedException`).
- `SQLiteJobRepository` (implements `JobRepositoryPort`):
  - Lightweight async SQLite using `aiosqlite`.
  - Stores job state and processed message logs.

### 2.4 Presentation Layer (`backend/presentation/`)
- **FastAPI Endpoints**:
  - `GET /api/channels`: Returns managed channels.
  - `POST /api/jobs`: Body `{ source_channel_id: int, target_channel_id: int }` -> starts job, returns `{ job_id: str }`.
  - `GET /api/jobs/{job_id}/stream`: Returns SSE stream (`text/event-stream`) of migration events.
  - `POST /api/jobs/{job_id}/cancel`: Halts active worker.

---

## 3. Frontend Design (React 19 + Feature-First Clean Architecture + Zustand)

### 3.1 Folder Structure
```text
frontend/src/
├── app/
│   ├── App.tsx
│   └── main.tsx
├── features/
│   └── migration/
│       ├── domain/
│       │   └── types.ts             # Channel, MigrationJob, ProgressPayload
│       ├── application/
│       │   ├── useMigrationStore.ts # Zustand global feature store
│       │   └── useMigrationStream.ts# Custom hook managing EventSource lifecycle
│       ├── infrastructure/
│       │   └── migrationApi.ts      # Fetch client for channels, start, cancel
│       └── presentation/
│           ├── components/
│           │   ├── ChannelCard.tsx
│           │   ├── ProgressRing.tsx
│           │   ├── TerminalLog.tsx
│           │   └── ConfirmationDialog.tsx
│           └── MigrationView.tsx    # Single page view (strictly <= 2 useStates)
└── shared/
    ├── components/                  # Button, Card, Badge, Alert
    └── lib/                         # cn() utility, formatters
```

### 3.2 Zustand State Management (`useMigrationStore`)
Handles all application-level and asynchronous states:
```typescript
interface MigrationState {
  channels: Channel[];
  selectedSourceId: number | null;
  selectedTargetId: number | null;
  activeJob: MigrationJob | null;
  progress: ProgressPayload | null;
  logs: string[];
  isLoadingChannels: boolean;
  isStartingJob: boolean;

  // Actions
  fetchChannels: () => Promise<void>;
  selectSource: (id: number) => void;
  selectTarget: (id: number) => void;
  startMigration: () => Promise<void>;
  cancelMigration: () => Promise<void>;
  appendLog: (message: string) => void;
  updateProgress: (payload: ProgressPayload) => void;
}
```

### 3.3 Strict `useState` Contract in `MigrationView`
In `MigrationView.tsx`, only 2 `useState` hooks are permitted:
1. `const [isConfirmOpen, setIsConfirmOpen] = useState(false);`
2. `const [searchQuery, setSearchQuery] = useState("");`

All other state (channel selection, job execution, error alerts, progress percentages, live log entries) is read directly from `useMigrationStore()`.

---

## 4. SQLite Schema (Idempotency & Checkpointing)

```sql
CREATE TABLE IF NOT EXISTS migration_jobs (
    id TEXT PRIMARY KEY,
    source_channel_id INTEGER NOT NULL,
    target_channel_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    total_videos INTEGER NOT NULL DEFAULT 0,
    processed_videos INTEGER NOT NULL DEFAULT 0,
    last_processed_msg_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS migration_items (
    job_id TEXT NOT NULL,
    source_message_id INTEGER NOT NULL,
    target_message_id INTEGER NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (job_id, source_message_id),
    FOREIGN KEY (job_id) REFERENCES migration_jobs(id)
);
```
