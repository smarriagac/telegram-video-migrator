# Feature: In-App Notification Center & Operational Telemetry Feed

Provide operators with a real-time In-App Notification Center accessible via a Header Bell Icon, displaying live alerts for Telegram evictions, FloodWait rotations, scheduled broadcast outcomes, and video processing completions with unread counts and read-state management.

Delivery strategy: single-pr

## Specs
- S1: Domain Entity & Persistence:
  - Create `AppNotification` entity in `backend/domain/entities/app_notification.py`.
  - Add `app_notifications` table in PostgreSQL & SQLite repositories.
  - Implement repository methods: `save_notification`, `list_notifications`, `mark_notification_as_read`, `mark_all_notifications_as_read`, `get_unread_notifications_count`.
- S2: Operational Alerting Integration:
  - Wire `AlertingService` to automatically persist `AppNotification` on channel evictions, broadcast failures, FloodWait events, and general operational alerts.
- S3: REST API Endpoints in `backend/presentation/api/routers/notifications.py`:
  - `GET /api/notifications`: Retrieve recent notifications (filterable by unread).
  - `GET /api/notifications/unread-count`: Fast counter endpoint for polling.
  - `PATCH /api/notifications/{id}/read`: Mark notification as read.
  - `POST /api/notifications/read-all`: Mark all notifications as read.
- S4: Frontend In-App Notification Bell in `AppLayout.tsx`:
  - Component `NotificationBell.tsx` placed in the top bar.
  - Live unread badge counter with periodic background polling.
  - Dropdown popover with severity badges, relative timestamps, navigation on click, and "Mark all as read" button.
  - Comply with max 2 `useState` hooks per component.
- S5: Automated Tests & Verification:
  - Unit tests in `backend/tests/test_notifications.py`.
  - 100% full pytest pass and frontend build verification.

## Tasks
- [x] T1 (S1): Create `AppNotification` entity and repository persistence in PostgreSQL and SQLite [inline]
- [x] T2 (S2): Wire `AlertingService` to store in-app notifications on operational events [inline]
- [x] T3 (S3): Implement notifications REST API router and register in `main.py` [inline]
- [x] T4 (S4): Build `NotificationBell.tsx` and integrate into `AppLayout.tsx` [inline]
- [x] T5 (S5): Write backend automated tests in `test_notifications.py` [inline]
- [x] T6 (S5): Verify full test suite, build frontend bundle, and commit conventional commit [inline]

## Log
- L1: Spec initialized under Gentle AI ODD protocol.
- L2: Completed AppNotification entity and schema in SQLite & PostgreSQL. Wired AlertingService. Built REST API router (/api/notifications) with unread counter. Created NotificationBell component with live popover and integrated into AppLayout. 100% tests passing (137/137). Deployed live.
