# Feature: Telegram Message Permalinks & Deep Jump Navigation

Enables full Telegram native permalink navigation for message links like `https://t.me/username/1332` or `https://t.me/c/channel_id/1332`:
Detects message permalinks in message text, resolves channel/chat and target message ID, switches to the target chat if needed, loads the target message, performs smooth scroll to center, and triggers a Telegram-style animated highlight flash.

Delivery strategy: single-pr

## Specs
- S1: Message Permalink Parsing & MTProto Resolution:
  - In `backend/domain/ports/telegram_gateway_port.py`:
    - `resolve_message_link(url_or_path: str, account_id: int | None = None) -> dict[str, Any]`
  - In `backend/infrastructure/telegram/telethon_adapter.py`:
    - Parse `https://t.me/{username}/{msg_id}`, `https://t.me/c/{internal_id}/{msg_id}`, `@username/{msg_id}`.
    - Resolve target entity and retrieve message via Telethon `client.get_messages(entity, ids=message_id)`.
    - Format message into `ChatMessage` entity with media/photo/video metadata and channel info.
- S2: REST API Endpoint:
  - In `backend/presentation/api/routers/dialogs.py`:
    - `POST /api/dialogs/resolve-message-link`: accepts `{"url": "...", "account_id": null}`, returns chat details and resolved message.
- S3: Backend Automated Tests:
  - Add tests in `backend/tests/test_telegram_message_permalinks.py` verifying regex parsing, entity resolution, and message retrieval.
- S4: Frontend API & Store:
  - In `frontend/src/features/chats/infrastructure/chatApi.ts`:
    - `resolveMessageLink(url: string, accountId?: number | null): Promise<ResolvedMessageLink>`
- S5: Frontend View & Smooth Jump Interaction:
  - In `frontend/src/features/chats/presentation/ChatsView.tsx`:
    - Update `renderFormattedMessageText` to recognize message permalinks distinctly (`t.me/.../{id}`).
    - Add `id={'msg-' + msg.id}` to message bubble elements.
    - Add `highlightedMessageId` in `viewState` and temporary highlight pulse effect.
    - Implement `handleMessagePermalinkClick`:
      - If in current chat: smooth scroll to `msg-${id}` and highlight.
      - If in another loaded chat: switch chat via `selectChat` and scroll/highlight after load.
      - If not in loaded messages: call `resolveMessageLink`, append message to store, switch chat, and jump/highlight.
    - Strictly maintain $\le 2$ `useState` hooks.
- S6: Verification & Deployment:
  - Run backend pytest and frontend vitest + build.
  - Deploy to Docker containers and test live.

## Tasks
- [x] T1 (S1-S2): Add `resolve_message_link` port, Telethon implementation, and REST endpoint in `dialogs.py` [inline]
- [x] T2 (S3): Create backend unit tests in `test_telegram_message_permalinks.py` and run them [inline]
- [x] T3 (S4): Add `resolveMessageLink` to `chatApi.ts` and types in `types.ts` [inline]
- [x] T4 (S5): Implement permalink detection, smooth scrolling, and animated highlight in `ChatsView.tsx` [inline]
- [x] T5 (S6): Run test suite, compile frontend build, deploy to Docker and verify live [inline]
- [x] T6 (S6): Update ODD task log, commit and push [inline]

## Log
- L1: Initialized ODD task for Telegram Message Permalinks & Deep Jump Navigation.
- L2: Extended `TelegramGatewayPort` and `TelethonAdapter` with `_parse_message_link` and `resolve_message_link` support for both public (`t.me/user/msg_id`) and private (`t.me/c/id/msg_id`) formats.
- L3: Added `POST /api/dialogs/resolve-message-link` REST endpoint.
- L4: Created and executed backend pytest in `test_telegram_message_permalinks.py` (3/3 passed).
- L5: Added `ResolvedMessageLink` type in `types.ts` and `resolveMessageLink` in `chatApi.ts`.
- L6: Added `ensureMessageLoaded` action in `useChatStore.ts`.
- L7: Updated `ChatsView.tsx` with permalink button decoration, `id={'msg-' + msg.id}`, highlight pulse CSS animation, and smooth jump navigation honoring $\le 2$ `useState` hooks.
- L8: Verified frontend build (`tsc -b && vite build`) and Vitest suite (19 test files, 68 tests passing).
- L9: Deployed artifacts to Nginx and tested live MTProto resolution with curl.
