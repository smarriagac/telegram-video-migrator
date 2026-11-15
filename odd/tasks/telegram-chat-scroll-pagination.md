# Feature: Telegram Chat Message Loading & Infinite Scroll Pagination (offset_id)

Implements full message loading and upward infinite scroll pagination (`offset_id`) for Telegram chats, mirroring native Telegram desktop/web behavior.

Delivery strategy: single-pr

## Specs
- S1: Backend Gateway & Router Support for `offset_id`:
  - `backend/domain/ports/telegram_gateway_port.py`: add `offset_id: int | None = None` to `get_chat_messages`.
  - `backend/application/use_cases/get_chat_messages_use_case.py`: pass `offset_id` when present.
  - `backend/infrastructure/telegram/telethon_adapter.py`: pass `offset_id` to `client.iter_messages(chat_id, offset_id=offset_id, limit=limit)`.
  - `backend/presentation/api/routers/dialogs.py`: accept `offset_id: int | None = Query(None)` in `GET /{chat_id}/messages`.
- S2: Frontend API Client & State Management:
  - `frontend/src/features/chats/infrastructure/chatApi.ts`: pass `offset_id` to `fetchMessages`.
  - `frontend/src/features/chats/application/useChatStore.ts`:
    - Add `isLoadingOlderMessages: boolean` and `hasMoreOlderMessages: Record<number, boolean>`.
    - Always load fresh message history on `selectChat` without stale empty cache lock.
    - Implement `loadOlderMessages(chatId)` fetching older messages by oldest message ID and prepending with deduplication.
- S3: Frontend Infinite Scroll & Viewport Preservation:
  - In `ChatsView.tsx`:
    - Listen to `onScroll`: when `scrollTop < 100`, trigger `loadOlderMessages`.
    - Preserve scroll anchor position using `scrollHeight` delta to prevent view jumping.
    - Top loading spinner and "Inicio del historial" marker.
- S4: Automated Tests & Verification:
  - Backend tests for `offset_id` pagination in `backend/tests/test_dialogs.py` and `backend/tests/test_telegram_hashtags.py`.
  - Frontend build and vitest tests.

## Tasks
- [x] T1 (S1): Add `offset_id` to port, use case, adapter, and REST endpoint [inline]
- [x] T2 (S2): Update `chatApi.fetchMessages` and `useChatStore` with `loadOlderMessages` [inline]
- [x] T3 (S3): Implement upward scroll pagination and scroll anchoring in `ChatsView.tsx` [inline]
- [x] T4 (S4): Add tests and verify backend/frontend suites [inline]
- [x] T5 (S4): Build and deploy to Docker containers [inline]

## Log
- L1: Initialized ODD task for Telegram Chat Message Loading & Infinite Scroll Pagination.
- L2: Implemented `offset_id` parameter in `TelegramGatewayPort`, `TelethonAdapter`, `GetChatMessagesUseCase`, and `GET /api/dialogs/{chat_id}/messages`.
- L3: Added `isLoadingOlderMessages`, `hasMoreOlderMessages`, and `loadOlderMessages` in `useChatStore` and updated `selectChat` to fetch fresh messages.
- L4: Implemented upward infinite scroll with DOM scroll-anchoring in `ChatsView.tsx` so viewport remains steady when prepending older messages.
- L5: Verified unit tests (pytest and vitest all passing), built with Vite and deployed to Docker containers.
