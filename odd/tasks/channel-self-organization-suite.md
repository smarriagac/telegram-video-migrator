# Feature: Channel Self-Organization Suite (In-Place Batch Tagging & Same-Channel Album Repacking)

Allow channel owners to organize their existing channels using two distinct workflows:
1. In-place batch caption editing/tagging: Injects `#tags` or modifies captions of existing messages without re-sending or altering message position.
2. Same-channel album repacking: Packages 2-10 existing separate media messages into a grouped Telegram Album (`MediaGroup`) within the same channel and optionally purges the loose original messages.

Delivery strategy: single-pr

## Specs
- S1: Backend Batch Caption Edit Endpoint:
  - Add `POST /api/channels/{channel_id}/messages/batch-edit-caption` in `channels.py`.
  - Support modes: `append` (attach tag to existing text), `prepend` (put tag first), `replace` (set exact caption).
  - Fetch messages in batch to preserve original captions when appending/prepending.
  - Audit logging of batch edits.
- S2: Same-Channel Album Repack & Purge Support:
  - Update `PublishAlbumRequest` with `delete_source_messages: bool = False`.
  - Remove restriction disallowing `target_channel_id == channel_id` to enable same-channel repacking.
  - When `delete_source_messages=True`, delete original loose messages after successful album publication.
- S3: Backend Automated Tests (TDD):
  - In `backend/tests/test_batch_edit_and_repack.py`:
    - Test in-place batch caption append, prepend, and replace.
    - Test same-channel album publication with `delete_source_messages=True`.
    - Test validation edge cases.
- S4: Frontend Unified Organization Modal (`OrganizeChannelModal.tsx`):
  - Two operational tabs:
    - Tab 1: "Etiquetar In-Situ" (Batch Edit): append/prepend `#tag`, instant update, 0 duplicates.
    - Tab 2: "Reempaquetar en Álbum" (MediaGroup): group into 1 album, optional purge of original loose messages, optional scheduler.
  - Canonical dark cyber design system (shadcn/ui), strictly 2 `useState` hooks budget.
  - Instant live feedback, zero browser alerts.
- S5: Integration in `MessageSelector.tsx` & API layer:
  - Add `batchEditCaptions` to `migrationApi.ts`.
  - Expose "Organizar ({count})" in the selection toolbar.
  - Re-fetch/update messages in `useMigrationStore` on completion.
  - Deploy frontend to Nginx container and verify end-to-end.

## Tasks
- [x] T1 (S1..S5): Create ODD task specification [inline]
- [x] T2 (S1): Implement `POST /api/channels/{channel_id}/messages/batch-edit-caption` in `channels.py` [inline]
- [x] T3 (S2): Support same-channel repacking and `delete_source_messages` in `publish-album` [inline]
- [x] T4 (S3): Create and run automated backend tests in `test_batch_edit_and_repack.py` [inline]
- [x] T5 (S4): Create unified `OrganizeChannelModal.tsx` with 2-hook budget and canonical tokens [inline]
- [x] T6 (S5): Integrate `OrganizeChannelModal` into `MessageSelector.tsx` and `migrationApi.ts` [inline]
- [x] T7 (S5): Build frontend bundle and deploy to Docker container [inline]
- [x] T8 (S5): Git commit and push to repository [inline]

## Log
- L1: User requested both options: in-place batch tagging without re-sending, and same-channel album repacking.
- L2: Verified Telegram MTProto constraints: in-place grouping is impossible without re-sending, but batch caption editing in-situ and same-channel repack with purge fulfill both user workflows.
- L3: Initialized ODD task specification in `odd/tasks/channel-self-organization-suite.md`.
- L4: Implemented `POST /api/channels/{channel_id}/messages/batch-edit-caption` supporting `append`, `prepend`, and `replace` modes.
- L5: Enhanced `publish-album` to support same-channel destination and automatic purge of original loose messages (`delete_source_messages=True`).
- L6: Added unit and integration tests in `test_batch_edit_and_repack.py`; all 104 backend tests passing.
- L7: Created `OrganizeChannelModal.tsx` featuring both tabs ("Etiquetar In-Situ" and "Reempaquetar en Álbum") adhering to the 2-hook budget.
- L8: Integrated in `MessageSelector.tsx`, compiled frontend bundle and deployed to `telegram_migrator_frontend`.
