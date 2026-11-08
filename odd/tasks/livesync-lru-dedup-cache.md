# Feature: LiveSync In-Memory LRU Deduplication Cache

Eliminate redundant database queries during live channel synchronization by implementing an in-memory bounded LRU deduplication cache for source message IDs per binding pair.

Delivery strategy: single-pr

## Specs
- S1: MessageDedupCache in `backend/application/services/live_sync_service.py`:
  - Create `MessageDedupCache` using `collections.OrderedDict` with bounded size (5,000 IDs per channel pair).
  - Methods: `is_cloned`, `mark_cloned`, `populate`, `is_initialized`, `invalidate`.
- S2: Integrate Cache into `LiveSyncService`:
  - In `_on_new_message` and `_process_queue_loop`: check `is_cloned` in memory before hitting `get_cloned_source_message_ids`.
  - When new message is enqueued or marked cloned, add to cache via `mark_cloned`.
  - On startup or `catch_up_delta`, initialize cache once from DB.
- S3: Automated Tests:
  - Unit tests in `backend/tests/test_livesync_dedup_cache.py`:
    - Test LRU eviction when exceeding max size.
    - Test fast hit without DB calls.
    - Test integration with `LiveSyncService`.

## Tasks
- [x] T1 (S1): Implement `MessageDedupCache` in `backend/application/services/live_sync_service.py` [inline]
- [x] T2 (S2): Wire cache into `LiveSyncService._on_new_message`, `_process_queue_loop`, and `catch_up_delta` [inline]
- [x] T3 (S3): Write automated tests in `backend/tests/test_livesync_dedup_cache.py` [inline]
- [x] T4 (S3): Run pytest verification [inline]
- [x] T5 (S3): Git commit and push with conventional commit message [inline]

## Log
- L1: Task initialized under Gentle AI ODD protocol.
- L2: Completed MessageDedupCache (OrderedDict LRU). Integrated into LiveSyncService. Added test_livesync_dedup_cache.py (100% pass). All live sync tests pass without regressions.
