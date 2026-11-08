# Task: Adaptive Concurrency & Proactive Rate Limiting Governor (ODD Spec)

## Context & Problem Statement
In high-throughput channel cloning, live sync, and broadcast pipelines, multiple workers often dispatch messages simultaneously.
Previously:
1. Workers relied on static delay mechanisms (`drip_delay_seconds` or static random sleep 1-3s).
2. When multiple workers target the same channel or share the same account session, their dispatches are uncoordinated, quickly triggering Telegram `FloodWaitError`.
3. When a FloodWait occurred, only the encountering worker slept, while other workers continued pounding the API, creating cascading flood waits and risking account deactivation or bans.

## Architectural Objective
Implement a centralized, adaptive **Rate Governor Engine** operating on an AIMD (Additive Increase / Multiplicative Decrease) token bucket algorithm keyed by `(account_id, target_channel_id)`:
1. **Token Bucket & Proactive Throttling**:
   - Capacity: 5 tokens (allows short controlled bursts).
   - Base refill rate: 0.5 tokens/sec (1 message every 2 seconds).
   - Cooperative non-blocking `acquire()`: all workers targeting the same channel share the same bucket and sleep cooperatively before dispatching.
2. **AIMD Adaptation & Global Freeze**:
   - On `FloodWaitDomainException`: immediately freezes all workers targeting that `(account_id, target_channel_id)` until the cooldown expiration timestamp; cuts refill rate by 30%; multiplies backoff by 1.5x (up to 8.0x max). Emits `RATE_LIMIT_ADAPTED` event via SSE broadcaster.
   - On consecutive successes (>= 5): restores refill rate (+0.05 tokens/s) and decreases backoff multiplier (-0.2) back to baseline 1.0x.
   - Tracks Exponential Moving Average (EMA) of Telegram response latencies to detect network congestion before flood waits occur.
3. **Domain & Application Services**:
   - [`backend/application/services/rate_governor_service.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/rate_governor_service.py): Core governor with `acquire`, `report_feedback`, `get_status`, `reset_channel`, `reset_all`.
   - Injected into [`CloneChannelVideosUseCase`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/use_cases/clone_channel_videos_use_case.py).
4. **REST API**:
   - `GET /api/system/rate-governor`: Detailed telemetry of all managed target channels, token levels, status (`HEALTHY` | `THROTTLED` | `FROZEN`), EMA latencies, and flood wait counts.
   - `POST /api/system/rate-governor/reset`: Reset backoff for a given channel or all channels.
5. **Frontend UI**:
   - [`RateGovernorCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/components/RateGovernorCard.tsx): Reactive telemetry dashboard in Settings (strictly $\le 2$ `useState` hooks) showing active channels, health badges, EMA latency, and manual reset buttons.
6. **Automated Verification**:
   - Comprehensive backend pytest suite in `backend/tests/test_rate_governor.py`.
   - Frontend Vitest suite in `frontend/src/features/settings/presentation/__tests__/RateGovernorCard.test.tsx`.

## Implementation & Verification Status: COMPLETED

### Backend
- Service: [`RateGovernorService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/rate_governor_service.py) with Token Bucket capacity 5, base refill rate 0.5 msg/s, cooperative non-blocking `acquire`, AIMD feedback `report_feedback`, per-target state tracking, latency EMA, and reset operations.
- Worker Integration: [`CloneChannelVideosUseCase`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/use_cases/clone_channel_videos_use_case.py) acquires tokens before dispatching to target channel, reports latency on success, and triggers instant Freeze on `FloodWaitDomainException`.
- REST Router: [`rate_governor.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/rate_governor.py) exposed `GET /api/system/rate-governor` and `POST /api/system/rate-governor/reset`.
- Dependency Wiring: Exposed in [`dependencies.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/dependencies.py) and registered in [`main.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/main.py).
- Bugfix: Prevented race condition in [`VideoProcessingService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/video_processing_service.py) where intermediate progress updates could overwrite external `CANCELLED` status.
- Pytest Suite: 182/182 tests passing (including 5/5 in `test_rate_governor.py`).

### Frontend
- API Client: [`rateGovernorApi.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/infrastructure/rateGovernorApi.ts).
- Telemetry Component: [`RateGovernorCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/components/RateGovernorCard.tsx) with live token levels, AIMD backoff indicators, EMA latency, filter toolbar, and single/all reset buttons (strictly 2 `useState` hooks).
- Tab Integration: Added `"governor"` tab in [`SettingsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/SettingsView.tsx) with `<Activity />` icon.
- Vitest Suite: 43/43 tests passing (including 5/5 in [`RateGovernorCard.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/__tests__/RateGovernorCard.test.tsx)).
- Production Build: `tsc -b && vite build` passing cleanly with 0 errors. Deployed to `telegram_migrator_frontend`.

