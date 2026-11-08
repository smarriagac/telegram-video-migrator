# Task: Migration Pre-Flight Check & Simulation Engine (Dry-Run)

## Problem Statement
When starting high-volume video migrations across channels, operators often launch jobs without knowing in advance whether:
1. The target channel actually grants publication rights (`can_post` / `post_messages`) to the assigned Telegram account.
2. The selected accounts are under active Telegram `FloodWait` cooldowns.
3. How many of the selected videos have already been cloned into the target channel.
4. Whether the server has sufficient temporary disk storage for media transcoding and downloads.

Failing midway through an hours-long batch creates stranded jobs and operator frustration.

## Target Architecture & Solution
1. **Pre-Flight Validation Service ([`pre_flight_service.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/pre_flight_service.py))**:
   - Validate target permissions: checks `can_post` flag for `target_channel_id`.
   - Validate account FloodWait state: checks cooldown with [`TelegramClientPool`](file:///home/sm/proyectos/telegram-video-migrator/backend/infrastructure/telegram/telegram_client_pool.py).
   - Delta & duplicate detection: queries `repo.get_cloned_source_message_ids()` to calculate `already_cloned_items` and `new_items_to_process`.
   - Host disk capacity check: evaluates `shutil.disk_usage()` vs estimated video transcoding space.
   - Computes realistic time estimation based on item count, drip delay, and watermarking pipeline.
2. **REST API Endpoint ([`jobs.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/jobs.py))**:
   - `POST /api/jobs/pre-flight`:
     - Request: `source_channel_id`, `target_channel_id`, `selected_message_ids`, `source_account_id`, `target_account_id`, `watermark_enabled`, `drip_delay_seconds`.
     - Response: structured `PreFlightReport` with `can_proceed`, stats, warnings, and blockers.
3. **Frontend Integration ([`MigrationView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/migration/presentation/MigrationView.tsx))**:
   - Add Pre-Flight simulation summary card in the migration wizard before launch:
     - Ready status badge (Green = Ready, Yellow = Warnings / Deduplication, Red = Blocked).
     - Live statistics: Items to copy vs items skipped (duplicates), estimated duration, required disk space.
     - Preserves strict architectural constraint: Maximum 2 `useState` hooks per component.
4. **Testing & Verification**:
   - Unit tests in `backend/tests/test_pre_flight_service.py` for permission failure, floodwait warning, duplicate calculation, and API endpoint.
   - Frontend tests in `frontend/src/features/migration/presentation/__tests__/PreFlightSummaryCard.test.tsx`.
   - 100% pass across backend (pytest) and frontend (vitest).
