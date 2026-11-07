# Feature: Multi-Account Failover & Account Switching for Live Sync

Enable users to switch the extraction account (`source_account_id`) on sync bindings marked as `ACCESS_REVOKED` (e.g., when the primary account is banned/evicted from an upstream channel), verifying connectivity with a secondary account and automatically resuming synchronization.

Delivery strategy: single-pr

## Specs
- S1: Multi-Account Switch Endpoint & Service Logic:
  - Add `switch_binding_account(source_channel_id, target_channel_id, new_account_id)` in `LiveSyncService`:
    - Checks that `new_account_id` exists in `TelegramClientPool` and is connected.
    - Resolves `source_channel_id` using the new account's Telegram client.
    - If accessible: updates binding with `source_account_id = new_account_id`, `status = "ACTIVE"`, `is_active = True`, `last_error = None`.
    - Automatically launches `catch_up_delta` to resume synchronization from the last synced message ID.
    - If the new account also lacks access: raises descriptive exception without corrupting binding state.
  - Add `POST /api/sync/bindings/{source_channel_id}/{target_channel_id}/switch-account` in `backend/presentation/api/routers/sync.py`:
    - Receives `new_account_id: int`.
    - Records audit log `LIVE_SYNC_ACCOUNT_SWITCH`.
- S2: Automated Backend Tests (TDD):
  - In `backend/tests/test_live_sync_service.py`:
    - Test switching a binding marked `ACCESS_REVOKED` to an authorized secondary account.
    - Verify binding transitions back to `status="ACTIVE"`, `is_active=True`, and clears `last_error`.
    - Test rejection when the secondary account also lacks channel access.
- S3: Frontend Multi-Account Failover UI (`LiveSyncHubView.tsx`):
  - In `LiveSyncHubView.tsx`:
    - When a binding has `status === "ACCESS_REVOKED"`:
      - Display an action button `Cambiar Cuenta` (or `Relevar`) next to `Recomprobar`.
      - Opens an inline/popover account selector listing registered Telegram accounts from `channelApi` / accounts store.
      - Upon selection: calls switch endpoint, displays success feedback, and refreshes matrix.
- S4: Architectural Constraints:
  - Strictly maximum 2 `useState` hooks in `LiveSyncHubView.tsx`.
  - Zero browser alerts (`window.alert`).
  - 100% automated test compliance.

## Tasks
- [x] T1 (S1): Implement `switch_binding_account` in `LiveSyncService` and repository [inline]
- [x] T2 (S1): Add `switch-account` endpoint in `backend/presentation/api/routers/sync.py` [inline]
- [x] T3 (S2): Write automated tests in `backend/tests/test_live_sync_service.py` [inline]
- [x] T4 (S3): Implement account switcher dialog/action in `LiveSyncHubView.tsx` within 2-hook budget [inline]
- [x] T5 (S4): Compile frontend bundle and deploy to Docker containers [inline]
- [x] T6 (S4): Run full pytest test suite [inline]
- [x] T7 (S4): Git commit and push with conventional commit message [inline]

## Log
- L1: User requested enabling multi-account failover so that when expelled from a channel (like La aldea del cacique), a secondary account can take over live synchronization.
- L2: Initialized ODD task specification in `odd/tasks/live-sync-multi-account-failover.md`.
- L3: Implemented `switch_binding_account` in `LiveSyncService` with channel accessibility validation and catch_up_delta resumption.
- L4: Added `/api/sync/bindings/{source}/{target}/switch-account` with audit logging in `backend/presentation/api/routers/sync.py`.
- L5: Added automated tests in `backend/tests/test_live_sync_service.py` covering success and failure paths (116/116 total tests passing).
- L6: Created `SwitchSyncAccountModal.tsx` and integrated it in `LiveSyncHubView.tsx` honoring the 2-hook architectural constraint.
- L7: Built frontend bundle and deployed to `telegram_migrator_frontend`. Restarted backend container.
