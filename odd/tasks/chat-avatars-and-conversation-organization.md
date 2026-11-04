# Feature: Chat & Channel Avatars and In-Conversation Organization

Enable real Telegram profile photos/avatars across chats and channels, and integrate the channel self-organization suite (in-place tagging & album repacking) directly into the Chats & Messages conversation interface (`ChatsView.tsx`).

Delivery strategy: single-pr

## Specs
- S1: Telegram Entity Profile Photo Avatar API:
  - Add `get_entity_avatar` to `TelegramGatewayPort` and `TelethonAdapter`.
  - In-memory/cached byte-level avatar retrieval using Telethon `download_profile_photo(entity, file=bytes, download_big=False)`.
  - Add `GET /api/dialogs/{chat_id}/avatar` and `GET /api/channels/{channel_id}/avatar` returning `image/jpeg` with caching headers.
- S2: Frontend Chat & Channel Avatar Display:
  - Create reusable `ChatAvatar` component with real profile photo thumbnail (`/api/dialogs/{id}/avatar`) and resilient fallback to initials/color.
  - Integrate real avatars in the Chats dialog list, Chat conversation header, and Channel selector dropdowns.
- S3: In-Conversation Multi-Message Selection & Organization in `ChatsView.tsx`:
  - Add selection toggle mode and checkboxes on messages in `ChatsView.tsx`.
  - Show floating action bar with "Organizar ({count})" button when messages are selected.
  - Mount `OrganizeChannelModal` allowing both in-place batch tagging (#tag) and album repacking directly within any chat or group.
  - Maintain the strict architectural constraint of maximum 2 `useState` hooks in `ChatsView.tsx`.
- S4: Backend Automated Tests (TDD):
  - In `backend/tests/test_avatar_and_chat_org.py`: test avatar endpoint responses, cache hits, 404 fallbacks, and dialog avatar retrieval.

## Tasks
- [x] T1 (S1..S4): Create ODD task specification [inline]
- [x] T2 (S1): Implement `get_entity_avatar` in `telethon_adapter.py` and avatar routes in `dialogs.py` & `channels.py` [inline]
- [x] T3 (S4): Write automated backend tests in `test_avatar_and_chat_org.py` [inline]
- [x] T4 (S2): Create `ChatAvatar.tsx` and integrate real avatars across `ChatsView.tsx` and channel selectors [inline]
- [x] T5 (S3): Implement message selection mode, action bar, and `OrganizeChannelModal` in `ChatsView.tsx` within 2-hook budget [inline]
- [x] T6 (S3): Compile frontend bundle and deploy to Docker container [inline]
- [x] T7 (S3): Git commit and push to repository [inline]

## Log
- L1: User requested real profile photos/avatars configured for each group/channel.
- L2: User requested self-organization (tagging in-situ & album repacking) to be available inside Chats and Messages as well.
- L3: Initialized ODD task specification in `odd/tasks/chat-avatars-and-conversation-organization.md`.
- L4: Implemented MTProto avatar extraction with memory caching in `telethon_adapter.py` and endpoints in `dialogs.py` and `channels.py`.
- L5: Created reusable `ChatAvatar` component and integrated it into chat lists, conversation header, and channel select dropdowns.
- L6: Added multi-message selection mode and mounted `OrganizeChannelModal` in `ChatsView.tsx` adhering to the 2-hook budget.
- L7: Verified all 108 backend tests pass and frontend builds with 0 errors and deployed to Docker.
