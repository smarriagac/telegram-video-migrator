# Feature: Canonical UI Modals & Selective Scheduled Migration Engine
Eradicate native browser alerts/confirms, implement canonical accessible modal dialogs adhering strictly to the <= 2 useState hooks view constraint, and fix selective message cloning across the scheduling and async execution lifecycle.
Delivery strategy: single-pr

## Specs
- S1: Canonical Modal Confirmation Component:
  - Create `ConfirmDialog` built on top of Radix UI `@/shared/components/ui/dialog` with `destructive` and `default` variants.
  - Accessible keyboard navigation (Escape to dismiss, focus trap, explicit action buttons).
  - Clean TypeScript interface with customizable title, description, confirmLabel, and cancelLabel.
- S2: Global Elimination of Native `window.confirm` and `window.alert`:
  - Audit and replace all native `window.confirm` calls in `JobsView.tsx`, `SettingsView.tsx`, and `LiveSyncHubView.tsx`.
  - Replace native `alert()` in `BillingPlansView.tsx` with modal dialog error feedback.
  - Strictly observe architectural constraint: maximum 2 `useState` hooks per view component by consolidating modal state into existing UI/filter hooks.
- S3: Scheduled Migration Feedback & Smart Scheduler Modal:
  - Create `ScheduledSuccessModal.tsx` showing planned execution date, channel route (Source -> Target), item count, job ID with clipboard copy, and quick navigation to Job Queue (`/jobs`).
  - Add scheduled job status card in `MigrationControlPanel.tsx` replacing the ambiguous "Clonar Todo el Canal" button when a scheduled job is active.
- S4: Selective Message Filtering Persistence in Backend Migration Engine:
  - Root cause fix: When a migration job was scheduled or triggered via `/run-now`, `selected_message_ids` was previously lost in transit because it was not stored in the database.
  - Persist `selected_message_ids` in `media_filter_rules` metadata in PostgreSQL and SQLite.
  - Propagate `selected_ids` in `run_scheduled_job_now` and `JobSchedulerService`.
  - Recover `selected_message_ids` in `CloneChannelVideosUseCase.execute` if omitted, ensuring only the exact user-selected messages are queued and cloned, never defaulting to all channel messages.
  - Add TDD automated regression test verifying that a scheduled job with 1 selected message only clones 1 message even if the channel has 4+ messages.

## Tasks
- [x] T1 (S1): Create `frontend/src/shared/components/ui/confirm-dialog.tsx` [inline]
- [x] T2 (S2): Refactor `JobsView.tsx` to use `ConfirmDialog` embedded in `uiState` (Hook #2) [inline]
- [x] T3 (S2): Refactor `SettingsView.tsx` to use `ConfirmDialog` embedded in `localState` (Hook #2) [inline]
- [x] T4 (S2): Refactor `LiveSyncHubView.tsx` to use `ConfirmDialog` as Hook #2 [inline]
- [x] T5 (S2): Refactor `BillingPlansView.tsx` to replace `alert()` with modal dialog while maintaining 2 `useState` hooks [inline]
- [x] T6 (S3): Create `frontend/src/features/migration/presentation/components/ScheduledSuccessModal.tsx` [inline]
- [x] T7 (S3): Update `MigrationControlPanel.tsx` to render scheduled migration status card with Smart Scheduler badge [inline]
- [x] T8 (S3): Update `MigrationView.tsx` to handle `modalState` (Hook #1) and launch `ScheduledSuccessModal` on schedule success [inline]
- [x] T9 (S4): Update `backend/presentation/api/routers/jobs.py` to persist `selected_message_ids` in `media_filter_rules` and pass to worker in `/run-now` [inline]
- [x] T10 (S4): Update `backend/application/services/job_scheduler_service.py` to propagate `selected_ids` on timer trigger [inline]
- [x] T11 (S4): Update `backend/application/use_cases/clone_channel_videos_use_case.py` to recover `selected_message_ids` from metadata and pre-warm `videos_cache` [inline]
- [x] T12 (S4): Add automated regression test `test_scheduled_job_with_selected_message_ids_preserved` in `backend/tests/test_jobs_management.py` [inline]
- [x] T13 (S1-S4): Run full backend test suite (95 tests passing) and Vite frontend build (0 errors) [inline]
- [x] T14 (S1-S4): Deploy updated frontend bundle and restart backend container in Docker [inline]

## Log
- L1: User requested replacement of native browser alerts/confirms with custom modals.
- L2: Audited entire frontend codebase, identifying `window.confirm` in `JobsView`, `SettingsView`, and `LiveSyncHubView`, plus `alert()` in `BillingPlansView`.
- L3: Built `ConfirmDialog` on top of Radix UI Dialog and integrated across all views under strict 2-hook limit.
- L4: User reported that scheduled migrations lacked visual confirmation and simply closed the modal.
- L5: Created `ScheduledSuccessModal.tsx` and scheduled job control card in `MigrationControlPanel.tsx`.
- L6: User reported critical bug: selecting 1 video resulted in all 4 channel videos being cloned when the job ran.
- L7: Investigated database audit logs and found `selected_items_count: 1` was received by API, but discarded when `is_scheduled=True`, causing `use_case.execute` to fallback to full channel migration.
- L8: Fixed backend persistence and worker dispatch across `jobs.py`, `job_scheduler_service.py`, and `clone_channel_videos_use_case.py`.
- L9: Implemented regression test `test_scheduled_job_with_selected_message_ids_preserved` in `test_jobs_management.py` verifying selective isolation.
- L10: Documented ODD specification in `odd/tasks/canonical-modals-and-selective-scheduled-cloning.md`.
