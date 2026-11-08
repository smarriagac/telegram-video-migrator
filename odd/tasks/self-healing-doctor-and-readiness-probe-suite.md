# Task: Self-Healing Doctor & Deep Diagnostics Suite (`/api/health/doctor`)

## Context & Motivation
Production operation of `telegram-video-migrator` involves multiple critical distributed systems: PostgreSQL (relational state and queue lock coordinator), Telegram MTProto sessions (persistent long-lived socket connections with flood control), FFmpeg transcoding processes, temporary disk scratchpads for media chunks, and asynchronous background daemons (Rate Governor, Live Sync listener, Video Processor).

Currently, `/api/health` only provides a superficial `{"status": "ok"}` check that does not verify real subsystem health, database latency, or disk pressure. A deep diagnostic suite ("System Doctor") is essential to:
1. Detect database degradation and connection pool starvation before workers time out.
2. Monitor MTProto session status across registered accounts.
3. Validate FFmpeg and codec engine availability in runtime containers.
4. Prevent out-of-disk crashes by tracking scratch storage (`/tmp`) and providing safe automated cleanup.
5. Offer 1-click self-healing remediation directly from the administrative UI.

---

## Architecture & Scope

### 1. Application Layer (`HealthDoctorService`)
- File: `backend/application/services/health_doctor_service.py`
- Diagnostics:
  - `check_database()`: Executes `SELECT 1` against PostgreSQL pool, measures round-trip latency in milliseconds, checks connection fallback mode.
  - `check_telegram_mtproto()`: Checks total registered accounts in repository vs pool, validates credentials encryption and connection readiness.
  - `check_media_engine()`: Checks presence and execution of `ffmpeg` and `ffprobe` via `shutil.which` and subprocess version detection.
  - `check_storage()`: Checks disk usage (`total`, `used`, `free`, `percentage`) on system temp directory / media download cache.
  - `check_background_services()`: Queries status of rate governor, live sync service, and background queues.
  - `remediate(action: str)`: Executes safe recovery routines:
    - `"clean_temp_storage"`: Sweeps stale temporary video files in scratch storage.
    - `"refresh_pool"`: Re-initializes and refreshes the Telegram client pool.
    - `"reset_rate_governor"`: Clears rate limits and resets buckets.

### 2. Presentation Layer (API Router)
- File: `backend/presentation/api/routers/doctor.py`
- Endpoints:
  - `GET /api/health/doctor`: Returns structured diagnostic report including subsystem statuses (`HEALTHY`, `DEGRADED`, `CRITICAL`), metrics, and actionable recommendations.
  - `POST /api/health/doctor/remediate`: Runs requested remediation action and returns outcome with reclaimed resources or reconnected clients.
- Wire in `backend/main.py` under prefix `/api`.

### 3. Frontend Architecture
- Types & API Client: `frontend/src/features/settings/infrastructure/doctorApi.ts`
- Presentation Component: `frontend/src/features/settings/presentation/components/SystemDoctorCard.tsx`
  - Constraint: Strictly $\le 2$ `useState` hooks.
  - Health badge (Emerald for Healthy, Amber for Degraded, Rose for Critical).
  - Diagnostic metric tiles (Database Latency, MTProto Accounts, FFmpeg Engine, Disk Scratch Space, Background Daemons).
  - Remediation Action Buttons with confirmation dialogs.
- Integration:
  - Add `"doctor"` tab to `SettingsView.tsx` with `Stethoscope` / `Activity` icon.

---

## Verification Criteria
1. Unit tests in `backend/tests/test_health_doctor.py` verifying diagnostic checks and remediation actions.
2. Full backend test suite passing (182+ tests).
3. Frontend component unit tests in `frontend/src/features/settings/presentation/__tests__/SystemDoctorCard.test.tsx`.
4. Full frontend test suite passing (45+ tests) and clean TypeScript build (`tsc -b && vite build`).
5. Real deployment verification on Docker containers (ports 7901/7900).
