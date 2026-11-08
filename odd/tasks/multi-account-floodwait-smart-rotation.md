# Feature: Multi-Account Smart FloodWait Failover & Auto-Rotation

Prevent broadcasting and cloning interruptions by automatically detecting Telegram `FloodWaitError` on an active account, placing it in temporary cooldown, seamlessly rotating to another available authenticated account in `TelegramClientPool`, and retrying the operation without human intervention or job abortion.

Delivery strategy: single-pr

## Specs
- S1: `TelegramClientPool` Cooldown Registry & Available Client Finder:
  - Add `_flood_wait_until: dict[int, float]` to `TelegramClientPool`.
  - Add `mark_flood_wait(account_id: int, seconds: int)` method.
  - Add `is_account_on_cooldown(account_id: int) -> tuple[bool, int]` method.
  - Add `get_available_client(tenant_id=None, exclude_account_id=None) -> tuple[int, str, TelegramClient] | None` returning an active client not on cooldown.
- S2: Smart Failover in `TelethonAdapter.broadcast_message`:
  - When `FloodWaitError` is raised for `target_id`:
    - Mark the current account on cooldown in the pool.
    - Query `pool.get_available_client(exclude_account_id=current_acc)`.
    - If a substitute account is found: switch active client, retry sending to `target_id` immediately, and continue remaining targets with the substitute account.
    - Record audit log or metric for failover event.
- S3: Automated Backend Tests:
  - Add unit tests in `backend/tests/test_floodwait_smart_rotation.py`:
    - Test marking account cooldown and finding available alternative.
    - Test broadcast failover when account #1 hits FloodWait, seamlessly continuing on account #2.
- S4: Verification:
  - 100% pytest suite compliance with zero regressions.

## Tasks
- [x] T1 (S1): Add FloodWait cooldown tracking and `get_available_client` to `TelegramClientPool` [inline]
- [x] T2 (S2): Implement automatic client rotation in `TelethonAdapter.broadcast_message` on FloodWait [inline]
- [x] T3 (S3): Write automated tests in `backend/tests/test_floodwait_smart_rotation.py` [inline]
- [x] T4 (S4): Run full pytest test suite [inline]
- [x] T5 (S4): Git commit and push with conventional commit message [inline]

## Log
- L1: User approved roadmap, completed Phase 1 (alerting). Starting Phase 2 (FloodWait smart auto-rotation).
- L2: Implemented FloodWait cooldown tracking & get_available_client in TelegramClientPool. Implemented dynamic failover in TelethonAdapter.broadcast_message. Added comprehensive tests in test_floodwait_smart_rotation.py. 129/129 tests passing.
