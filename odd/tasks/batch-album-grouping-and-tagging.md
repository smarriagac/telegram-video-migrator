# Feature: Batch Album Grouping & Tagging (MediaGroup)

Permit users to select 2 to 10 photos/videos in a source channel and publish/migrate them as a grouped Telegram Album (`SendMultiMedia` / `MediaGroup`) with a shared caption or hashtag (e.g. `#ejemplo1`) for optimal organization, filtering and searchability.

Delivery strategy: single-pr

## Specs
- S1: Backend Telegram Adapter MediaGroup Implementation:
  - Add `send_media_album` to `TelethonAdapter` (and gateway interface).
  - Enforce Telegram protocol bounds: 2 <= len(message_ids) <= 10.
  - Efficient zero-download reference linking via MTProto `SendMultiMediaRequest`.
  - Resilient temporary download/upload fallback if source media has copy restrictions.
  - Support optional scheduling (`schedule_date`) and single shared caption/hashtag.
- S2: Channels API Router Album Endpoint:
  - Add `POST /api/channels/{channel_id}/publish-album` endpoint in `channels.py`.
  - Validate parameters (target channel, 2-10 messages, caption, accounts).
  - Audit logging of album publications.
- S3: Backend Automated Tests (TDD):
  - Unit & API tests in `backend/tests/test_album_grouping.py`.
  - Verify successful album dispatch, validation errors (< 2 or > 10 messages), and scheduled date pass-through.
- S4: Frontend Modal Component (`CreateAlbumModal.tsx`):
  - Canonical modal dialog using shadcn/ui tokens.
  - Preview of selected 2-10 media items (thumbnails, badges, media types).
  - Target channel selector and caption input (supporting `#tags` and text).
  - Adhere to the strict architectural budget of maximum 2 `useState` hooks.
- S5: Integration in `MessageSelector.tsx`:
  - Add "Agrupar Álbum ({count})" action button in the selection toolbar.
  - Validate 2-10 item limit with inline guidance when count is outside bounds.
  - Deploy frontend to Nginx container and verify end-to-end.

## Tasks
- [x] T1 (S1..S5): Create ODD task specification [inline]
- [x] T2 (S1): Implement `send_media_album` in `telethon_adapter.py` and gateway interface [inline]
- [x] T3 (S2): Implement `POST /api/channels/{channel_id}/publish-album` in `channels.py` [inline]
- [x] T4 (S3): Create and run automated backend tests in `test_album_grouping.py` [inline]
- [x] T5 (S4): Create `CreateAlbumModal.tsx` with canonical shadcn tokens and 2-hook budget [inline]
- [x] T6 (S5): Integrate `CreateAlbumModal` into `MessageSelector.tsx` and API layer [inline]
- [x] T7 (S5): Compile frontend bundle and deploy to Docker container [inline]
- [x] T8 (S5): Git commit and push to repository [inline]

## Log
- L1: User requested ability to organize channel content by selecting 3-4 images/videos and assigning them a common tag `#ejemplo1`.
- L2: Confirmed architectural requirement: Telegram Albums (MediaGroup) where media is posted together in a single visual collage sharing one caption for filtering.
- L3: Initialized ODD task specification in `odd/tasks/batch-album-grouping-and-tagging.md`.
- L4: Added `send_media_album` to `TelegramGatewayPort` and `TelethonAdapter` with reference-based `SendMultiMediaRequest` and resilient download fallback.
- L5: Implemented `POST /api/channels/{channel_id}/publish-album` with validation (2..10 items), audit logging and error handling.
- L6: Added unit and route tests in `backend/tests/test_album_grouping.py`; 100/100 tests passing across entire backend suite.
- L7: Built `CreateAlbumModal.tsx` adhering to strict 2-hook limit, canonical dark cyber palette, tag presets, and Smart Scheduler integration.
- L8: Integrated album action in `MessageSelector.tsx`, built Vite distribution and deployed to `telegram_migrator_frontend`.
