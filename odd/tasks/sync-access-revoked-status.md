# Feature: Real-Time Access-Revoked Status Detection in Live Sync Hub

Detect and prominently display when a Telegram account has been kicked, evicted, or banned from a source channel or group (`ACCESS_REVOKED`), preventing misleading 'ACTIVO' statuses and stopping ghost synchronization attempts.

Delivery strategy: single-pr

## Specs
- S1: Binding Health & Status State Machine:
  - Add `status: str` ("ACTIVE" | "PAUSED" | "ACCESS_REVOKED" | "ERROR") and `last_error: str | None` to `ChannelSyncBinding` domain entity and database schema.
  - In `postgres_job_repository.py` and `sqlite_job_repository.py`:
    - Persist `status` and `last_error` in `channel_sync_bindings`.
    - Auto-migrate table with `status VARCHAR(32) DEFAULT 'ACTIVE'` and `last_error VARCHAR(500)`.
- S2: Automatic Access Revocation Detection (`LiveSyncService`):
  - In `catch_up_delta` and event dispatching:
    - Catch `ChannelPrivateError`, `UserBannedInChannelError`, and entity resolution errors (`Could not find the input entity for PeerChannel`).
    - Automatically transition binding to `status = "ACCESS_REVOKED"`, `is_active = False`, and record descriptive `last_error`: "Fuiste expulsado del canal o el acceso fue revocado en Telegram".
    - Save updated state in repository and broadcast update.
- S3: Live Sync Verification Endpoint:
  - Add `POST /api/sync/bindings/{source_id}/{target_id}/verify` endpoint to check live MTProto accessibility on demand.
- S4: Frontend Binding Status & Warning Presentation (`LiveSyncHubView.tsx`):
  - In both Desktop table and Mobile card views:
    - If `status === "ACCESS_REVOKED"`:
      - Render prominent destructive/amber badge: `⚠️ EXPULSADO / SIN ACCESO`.
      - Show descriptive subtext: `La cuenta fue expulsada de este grupo en Telegram. Sincronización no disponible.`
      - Lock or disable the active switch to prevent confusing active toggles.
    - If `is_active`: `ACTIVO` (emerald).
    - If paused: `PAUSA` (muted).
- S5: Automated Tests & Verification:
  - Backend tests verifying `ACCESS_REVOKED` transition when Telegram raises `ChannelPrivateError`.
  - Frontend TypeScript compilation and responsive verification.

## Tasks
- [x] T1 (S1): Add `status` and `last_error` to `ChannelSyncBinding` and repositories [inline]
- [x] T2 (S2): Implement automatic `ACCESS_REVOKED` detection in `LiveSyncService` [inline]
- [x] T3 (S3): Add verify endpoint in `sync.py` [inline]
- [x] T4 (S5): Write automated backend tests in `backend/tests/test_live_sync_service.py` [inline]
- [x] T5 (S4): Update `LiveSyncHubView.tsx` to render `EXPULSADO / SIN ACCESO` status [inline]
- [x] T6 (S5): Compile frontend bundle and deploy to Docker containers [inline]
- [x] T7 (S5): Run full pytest test suite [inline]
- [x] T8 (S5): Git commit and push with conventional commit message [inline]

## Log
- L1: User pointed out that for a group from which they were expelled (🔥🪗La aldea del cacique🔥🪗), the UI still misleadingly displayed 'ACTIVO'.
- L2: Initialized ODD task specification in `odd/tasks/sync-access-revoked-status.md`.
- L3: Added `status` and `last_error` columns to `channel_sync_bindings` and entity model.
- L4: Implemented automatic `ACCESS_REVOKED` detection in `LiveSyncService.catch_up_delta` and created on-demand verification endpoint.
- L5: Added unit test in `test_live_sync_service.py` asserting transition to `ACCESS_REVOKED`.
- L6: Rendered `⚠️ EXPULSADO / SIN ACCESO` badge and disabled switch in `LiveSyncHubView.tsx`.
- L7: Verified live database transition on `La aldea del cacique` to `ACCESS_REVOKED`. All 114 tests passing.
