# Task: Unified Real-Time SSE Event Stream

## Problem Statement
The frontend currently relies on aggressive HTTP polling intervals to keep the UI up-to-date:
- [`JobsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/JobsView.tsx) polls `fetchJobs()` and `fetchFfmpegJobs()` every 5 seconds.
- [`NotificationBell.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/shared/components/NotificationBell.tsx) polls `loadUnreadCount()` every 20 seconds.
This polling generates unnecessary database queries, saturates HTTP connection pools, wastes client battery/bandwidth, and introduces latency in UI updates during high-throughput migrations.

## Target Architecture & Solution
1. **Event Broadcaster Enhancement ([`broadcaster.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/broadcaster.py))**:
   - Add persistent multiplexed streaming support with keep-alive heartbeats (`auto_close=False`).
   - Standardize event envelopes: `{"type": str, "data": Any}`.
2. **Unified Backend SSE Endpoint ([`backend/presentation/api/routers/events.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/events.py))**:
   - `GET /api/events/stream`: Server-Sent Events stream using `sse-starlette`.
   - Sends initial connection handshake, forwards `global_events`, and sends ping heartbeats every 15 seconds.
3. **Event Emitters Across Core Domains**:
   - Emit `JOB_PROGRESS` and `JOB_STATUS_CHANGE` on migration job lifecycle events in [`jobs.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/jobs.py).
   - Emit `NOTIFICATION_UPDATE` on creation, reading, and batch-read in [`notifications.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/presentation/api/routers/notifications.py) and [`alerting_service.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/alerting_service.py).
4. **Frontend Reactive Hook & Polling Elimination**:
   - Create [`useGlobalEventStream.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/shared/hooks/useGlobalEventStream.ts) with auto-reconnect and event listeners.
   - Replace `setInterval` in [`NotificationBell.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/shared/components/NotificationBell.tsx) and [`JobsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/jobs/presentation/JobsView.tsx) with event stream subscription.
   - Architectural constraint: Max 2 `useState` hooks preserved.
5. **Verification**:
   - Backend automated tests for `EventBroadcaster` and `/api/events/stream`.
   - Frontend Vitest tests for `useGlobalEventStream` and reactive updates in `NotificationBell`.
   - Full test suites pass on both backend and frontend.
