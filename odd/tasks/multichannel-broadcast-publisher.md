# Feature: Multi-Channel Broadcast Message Publisher

Enable users to compose rich promotional or informational messages (text with #hashtags, emojis, single or multiple photos/GIFs/videos as albums) and broadcast them simultaneously across multiple eligible Telegram channels and groups (own channels, administered groups, or groups with posting rights) with automated rate-limiting pacing to prevent FloodWait.

Delivery strategy: single-pr

## Specs
- S1: Broadcast Message Endpoint & Gateway Method:
  - Add `broadcast_message` to `TelegramGatewayPort` and `TelethonAdapter`:
    - Parameters: `target_ids: list[int]`, `text: str`, `media_paths: list[str] | None`, `account_id: int | None`, `delay_seconds: float = 1.0`.
    - Pacing: 1.0s delay between successive target deliveries to avoid Telegram FloodWait.
    - Media dispatch:
      - Plain text: `client.send_message(entity, text)`.
      - Single photo/video/gif: `client.send_file(entity, file=media_paths[0], caption=text)`.
      - Multiple photos/videos (album): `client.send_file(entity, file=media_paths, caption=text)`.
    - Resilient error handling per target (records successes and failures individually without failing the entire batch).
  - Add `POST /api/channels/broadcast` in `channels.py`:
    - Multipart form: `target_ids: str` (comma-separated or JSON list of IDs), `text: str`, `account_id: int | None`, `files: list[UploadFile]`.
    - Records audit log `MESSAGE_BROADCAST`.
    - Returns `BroadcastResponse` with status, counts, and per-target results.
- S2: Automated Backend Tests (TDD):
  - In `backend/tests/test_broadcast_api.py`:
    - Test broadcast endpoint with text-only message to multiple targets.
    - Test broadcast with single media file.
    - Test broadcast with multiple media files (album).
    - Test target failures and partial success reporting.
    - Test validation: empty text & files rejection, target count constraints.
- S3: Frontend Multi-Channel Broadcast Modal (`BroadcastMessageModal.tsx`):
  - Accessible from `ChatsView.tsx` and `ChannelManagementView.tsx` via "Difusión Multicanal" / "Nuevo Broadcast" button.
  - Target selection:
    - Lists only channels and groups where `can_post === true`.
    - Search input to filter target channels by title/username.
    - "Seleccionar Todos" / "Deseleccionar Todos" quick toggles.
    - Displays real avatars, subscriber/member count, and `👑 Canal Propio` / `Admin` badges.
  - Message composer:
    - Textarea with hashtag presets pills (`#promocion`, `#oferta`, `#anuncio`, `#vip`, `#nuevo`, `#sorteo`, etc.).
    - File picker supporting multiple images, video, or GIF.
    - Preview thumbnails of selected files with remove button.
  - Delivery progress:
    - Real-time progress bar while dispatching (`Enviando 3 de 10...`).
    - Detailed completion summary showing successful and failed channels.
  - Strict architectural constraints:
    - Maximum 2 `useState` hooks in `BroadcastMessageModal.tsx` and `ChatsView.tsx`.
- S4: Frontend Integration & Verification:
  - Add "Difusión" button in `ChatsView.tsx` top toolbar.
  - Compile frontend with 0 TypeScript errors and verify all 108+ backend tests pass.

## Tasks
- [x] T1 (S1): Add `broadcast_message` to `TelegramGatewayPort` and `TelethonAdapter` [inline]
- [x] T2 (S1): Implement `POST /api/channels/broadcast` endpoint in `channels.py` [inline]
- [x] T3 (S2): Write automated tests in `backend/tests/test_broadcast_api.py` [inline]
- [x] T4 (S3): Create `BroadcastMessageModal.tsx` adhering to 2-hook budget [inline]
- [x] T5 (S4): Connect modal to `ChatsView.tsx` and `ChannelManagementView.tsx` [inline]
- [x] T6 (S4): Compile frontend bundle and deploy to Docker containers [inline]
- [x] T7 (S4): Run full backend test suite (`pytest`) [inline]
- [x] T8 (S4): Git commit and push with conventional commit message [inline]

## Log
- L1: User requested ability to compose a message with text, hashtags, and media (images, GIF, video) and broadcast it to multiple channels/groups where posting is permitted.
- L2: Initialized ODD task specification in `odd/tasks/multichannel-broadcast-publisher.md`.
- L3: Added `broadcast_message` method in `TelegramGatewayPort` and `TelethonAdapter` with pacing rate-limiting (1.0s delay between targets) and support for plain text, single media, and atomic media albums.
- L4: Implemented `POST /api/channels/broadcast` multipart endpoint with target parsing, file uploads, audit log, and per-target result reporting.
- L5: Added automated tests in `backend/tests/test_broadcast_api.py` (validation, single media, albums, unit adapter test).
- L6: Created `BroadcastMessageModal.tsx` supporting hashtag presets, multi-file attachments, target filters, and progress tracking adhering strictly to the 2-hook budget.
- L7: Verified all 113 backend tests pass and frontend builds with 0 errors.
