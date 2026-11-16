# Feature: Pinned Messages Bar & Long-Press Message Pinning

Delivery strategy: single-pr

## Summary
Add support for pinning messages in Telegram chats/channels ("fijar un mensaje a la ventana del chat, así como telegram").
1. Trigger pinning via click sostenido (long press hold for 500ms on desktop and touch) and via a `Pin` button in message hover actions.
2. Render a native Telegram-styled pinned message bar fixed at the top of the chat area (below the header) with the message author, snippet, thumbnail badge, click-to-scroll, and unpin button.
3. Backend MTProto support for `pin_message` and `unpin_message` via Telethon gateway and REST endpoints.
4. Smooth scroll and context loading when clicking the pinned message banner.

## Specs
- S1: Backend Gateway & Port:
  - Add `pin_chat_message(chat_id, message_id, notify, account_id)`
  - Add `unpin_chat_message(chat_id, message_id, account_id)`
  - Add `get_pinned_messages(chat_id, limit, account_id)` using `types.InputMessagesFilterPinned()`
- S2: REST API Endpoints in `dialogs.py`:
  - `GET /api/dialogs/{chat_id}/pinned`
  - `POST /api/dialogs/{chat_id}/messages/{message_id}/pin`
  - `DELETE /api/dialogs/{chat_id}/messages/{message_id}/pin`
- S3: Automated Backend Unit & Integration Tests:
  - Verify pin, unpin, and get_pinned endpoints in `backend/tests/test_telegram_pinned_messages.py`.
- S4: Frontend API client in `chatApi.ts`:
  - `fetchPinnedMessage(chatId, accountId)`
  - `pinMessage(chatId, messageId, accountId, notify)`
  - `unpinMessage(chatId, messageId, accountId)`
- S5: Frontend View in `ChatsView.tsx`:
  - Long-press / click sostenido handler (500ms hold on mouse/touch) triggering pin action with visual toast / feedback.
  - Pin icon button in hover actions (`Pin` / `PinOff`).
  - Pinned message banner at top of chat:
    - Vertical cyan bar, pin icon, "Mensaje fijado" header.
    - Preview snippet with text or media type.
    - Smooth scroll to message using `loadMessageContext` so context before the pin is also present.
    - Unpin button (`X`) with optimistic UI update.
  - Strictly maintain $\le 2$ `useState` hooks.

## Tasks
- [x] T1 (S1): Add `pin_chat_message`, `unpin_chat_message`, and `get_pinned_messages` to `TelegramGatewayPort` and `TelethonAdapter` [inline]
- [x] T2 (S2): Implement `/api/dialogs/{chat_id}/pinned` and pin/unpin REST endpoints in `dialogs.py` [inline]
- [x] T3 (S3): Write automated tests in `backend/tests/test_telegram_pinned_messages.py` and run pytest [inline]
- [x] T4 (S4): Add `fetchPinnedMessage`, `pinMessage`, and `unpinMessage` in `chatApi.ts` [inline]
- [x] T5 (S5): Implement long-press (click sostenido) and hover pin button in `ChatsView.tsx` with pinned message banner [inline]
- [x] T6 (S5): Verify $\le 2$ `useState` hooks, run frontend vitest, compile frontend build [inline]
- [x] T7 (S5): Deploy to Docker, verify live on channel `-1004337257363`, commit and push [inline]

## Log
- L1: Initialized ODD task for Telegram Pinned Messages Bar & Long-Press Message Pinning.
- L2: Added `pin_chat_message`, `unpin_chat_message`, and `get_pinned_messages` to `TelegramGatewayPort` and implemented with Telethon MTProto calls (`client.pin_message`, `client.unpin_message`, `iter_messages(filter=InputMessagesFilterPinned)`).
- L3: Exposed REST endpoints in `backend/presentation/api/routers/dialogs.py` (`GET /{chat_id}/pinned`, `POST /{chat_id}/messages/{message_id}/pin`, `DELETE /{chat_id}/messages/{message_id}/pin`).
- L4: Verified with `backend/tests/test_telegram_pinned_messages.py` passing 100% in Docker container.
- L5: Integrated Pinned Message Bar, 500ms long-press hold timer, and hover pin button in `ChatsView.tsx` with canonical `ConfirmDialog`.
- L6: Verified strictly $\le 2$ `useState` hooks in `ChatsView.tsx`, bundle built in 3.80s, vitest suite passed (20/20 files, 73/73 tests).
- L7: Deployed live to `telegram_migrator_frontend` and `telegram_migrator_backend`, tested live via curl confirming message 1460 returned as pinned for channel `-1004337257363`.
