# ODD Task: Dynamic Network Bandwidth Shaper & Transfer Speed Throttler

## Status: COMPLETED
**Assigned**: Senior Architect
**Scope**: Token-bucket byte rate limiter, adaptive egress throttling, live transfer speed telemetry, REST API for runtime bandwidth caps, and frontend controls in Rate Governor card ($\le 2$ `useState`).

---

## 1. Problem & Context
During concurrent video migrations and chunked MTProto uploads (>2GB parts), unconstrained transfer speeds can saturate VPS network interfaces, spike CPU/RAM contention, and trigger Telegram connection resets or ISP-level QoS throttling.
Currently, [`RateGovernorService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/rate_governor_service.py) regulates message dispatch frequency (token bucket for messages) and handles FloodWait freezes, but does not provide byte-level bandwidth rate limiting.

---

## 2. Technical Architecture & Design

### 2.1 Bandwidth Shaper Token Bucket
- `BandwidthShaper` class (or integrated in `RateGovernorService`):
  - `bandwidth_limit_bytes_per_sec`: Configurable limit (e.g. `5 * 1024 * 1024` for 5 MB/s; `0` or `None` = unlimited).
  - `throttle_bytes(byte_count: int)`: Asynchronous sleep generator based on token consumption and elapsed time.
  - Telemetry:
    - `current_rate_bytes_per_sec`: Instantaneous moving average.
    - `total_bytes_transferred`: Cumulative byte counter.
    - `bandwidth_limit_mbps`: Friendly representation in megabytes/sec.

### 2.2 Integration Points
- [`BigMediaUploadService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/big_media_upload_service.py): Throttles chunk uploads and part transfers.
- [`RateGovernorService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/rate_governor_service.py): Exposes shaper methods and telemetry in `get_status()`.

### 2.3 Presentation Layer
- **REST API** ([`routers/alerts.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/alerts.py) or new `/api/rate-governor/bandwidth`):
  - `GET /api/rate-governor/bandwidth`: Status and telemetry.
  - `PUT /api/rate-governor/bandwidth`: Update rate cap.
- **Frontend** ([`RateGovernorCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/components/RateGovernorCard.tsx)):
  - Bandwidth rate cap selector: Ilimitado, 5 MB/s, 10 MB/s, 20 MB/s, 50 MB/s.
  - Live transfer speed meter ($\le 2$ `useState` constraint).

---

## 3. Verification Plan
1. Unit tests in `backend/tests/test_rate_governor.py` for `throttle_bytes`, rate calculation, and zero/unlimited modes.
2. Endpoint API integration tests in `test_rate_governor.py`.
3. Frontend vitest tests and production bundle build.
4. Container deployment and curl verification.
