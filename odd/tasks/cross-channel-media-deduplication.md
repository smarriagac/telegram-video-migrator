# ODD Task: Cross-Channel Media Deduplication & Fast-Forward Engine

## Status: COMPLETED
**Assigned**: Senior Architect
**Scope**: SHA-256 media fingerprint indexing across channels, zero-retransfer fast-forward execution, deduplication telemetry in queue stats, REST API for deduplication analytics, and frontend visual indicators ($\le 2$ `useState`).

---

## 1. Problem & Context
When running bulk migrations or continuous synchronizations across Telegram channels, channels frequently share identical videos, documents, or media assets.
Without deduplication:
1. Redundant network egress and MTProto rate limits are consumed repeatedly downloading and re-uploading the exact same multi-gigabyte files.
2. Target channels accumulate duplicate posts when rerun or when multiple source channels feed a central repository.
3. Users have no visibility into how many duplicate transfers were avoided or bandwidth saved.

---

## 2. Technical Architecture & Design

### 2.1 Media Fingerprinting & Indexing
- Utilize [`FingerprintService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/fingerprint_service.py) to generate deterministic SHA-256 hashes based on MTProto Document IDs and structural media attributes (size, duration, dimensions).
- Table `migrated_media_fingerprints`:
  - `target_channel_id`: BigInt / Integer.
  - `fingerprint_hash`: VARCHAR(128).
  - `source_channel_id`, `source_message_id`, `target_message_id`, `media_type`.
  - Indexes on `(target_channel_id, fingerprint_hash)` and `fingerprint_hash`.

### 2.2 Fast-Forward Execution in Pipeline
- In [`CloneChannelVideosUseCase`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/use_cases/clone_channel_videos_use_case.py):
  1. Compute fingerprint hash for each queued media.
  2. Query `get_media_fingerprint(job.target_id, fp_hash)`.
  3. If present: **Fast-Forward**. Mark queue item as `COMPLETED` with `is_deduplicated=True`, reuse `target_message_id`, skip download/upload, and report 0-byte transfer savings.
  4. Query `find_media_fingerprint_anywhere(fp_hash)` for cross-channel presence.
  5. Upon standard copy completion, record fingerprint in repository.

### 2.3 Repository Layer
- Add to [`JobRepositoryPort`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/ports/job_repository_port.py):
  - `get_media_fingerprint(target_channel_id: int, fingerprint_hash: str) -> dict[str, Any] | None`
  - `find_media_fingerprint_anywhere(fingerprint_hash: str) -> dict[str, Any] | None`
  - `get_deduplication_stats() -> dict[str, Any]`
- Implement in [`SqliteJobRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/sqlite_job_repository.py) and [`PostgresJobRepository`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/persistence/postgres_job_repository.py).
- Add `is_deduplicated` column to `migration_queue` with backward compatibility.

### 2.4 Presentation & Telemetry
- REST API:
  - `GET /api/migrations/deduplication/stats`: Total fingerprints, duplicates avoided, estimated bandwidth saved.
  - Include `deduplicated` count in `get_queue_stats`.
- Frontend:
  - Add `Deduplicado (Fast-Forward)` badge in queue views.
  - Display bandwidth savings in analytics / job status.

---

## 3. Verification Plan
1. Unit tests for `get_media_fingerprint`, `find_media_fingerprint_anywhere`, and `get_deduplication_stats` in SQLite and Postgres repos.
2. Fast-forward execution test in `test_migration_queue.py`.
3. REST API tests in `test_jobs.py` / `test_deduplication.py`.
4. Frontend vitest tests and production bundle build.
5. Container deployment and curl verification.
