# Feature: Telegram In-App Bot & Button Navigation

Ensures interactive button URLs and deep links (such as `https://t.me/bot?start=payload`, message permalinks, and invites) stay inside the application window without redirecting to official Telegram web/app.

Delivery strategy: single-pr

## Specs
- S1: Backend Open Bot Start Action:
  - In `backend/domain/ports/telegram_gateway_port.py`:
    - `open_bot_start(bot_username: str, start_param: str | None = None, account_id: int | None = None) -> dict[str, Any]`
  - In `backend/infrastructure/telegram/telethon_adapter.py`:
    - Resolves bot entity and sends `/start <start_param>` or `/start`.
    - Returns `{ "success": True, "chat_id": entity.id, "chat_title": ..., "chat_username": ... }`.
  - In `backend/presentation/api/routers/dialogs.py`:
    - `POST /api/dialogs/open-bot`: accepts `{"bot_username": str, "start_param": str | None = None, "account_id": int | None = None}`.
- S2: Backend Automated Tests:
  - In `backend/tests/test_telegram_open_bot.py`:
    - Test `open_bot_start` with start param.
    - Test `POST /api/dialogs/open-bot` endpoint.
- S3: Frontend API & Action Router:
  - In `frontend/src/features/chats/infrastructure/chatApi.ts`:
    - `openBot(botUsername: string, startParam?: string | null, accountId?: number | null)`
  - In `frontend/src/features/chats/presentation/ChatsView.tsx`:
    - Implement `handleTelegramActionClick(url: string)`:
      - Intercepts `t.me/{bot}?start={payload}`: calls `chatApi.openBot`, reloads dialogs, and selects the bot chat.
      - Intercepts message permalinks (`t.me/{chat}/{id}`): jumps to and highlights the message.
      - Intercepts invite links (`t.me/+...`): opens `JoinInviteModal`.
      - Intercepts user/channel links (`t.me/{username}`): selects chat or opens preview.
      - Only opens external (non-Telegram) URLs in a new browser tab.
    - Update inline buttons in message bubbles to use `handleTelegramActionClick`.
    - Strictly maintain $\le 2$ `useState` hooks.
- S4: Verification & Deployment:
  - Run backend pytest and frontend vitest + build.
  - Deploy to Docker containers and test live.

## Tasks
- [x] T1 (S1): Add `open_bot_start` port, Telethon implementation, and REST endpoint in `dialogs.py` [inline]
- [x] T2 (S2): Create backend unit tests in `test_telegram_open_bot.py` and run them [inline]
- [x] T3 (S3): Add `openBot` to `chatApi.ts` [inline]
- [x] T4 (S3): Implement `handleTelegramActionClick` and in-app button navigation in `ChatsView.tsx` [inline]
- [x] T5 (S4): Run tests, build frontend, deploy to Docker and verify live [inline]
- [x] T6 (S4): Complete ODD log, commit and push [inline]

## Log
- L1: Initialized ODD task for Telegram In-App Bot & Button Navigation.
- L2: Added `open_bot_start` port and implementation in `TelethonAdapter`, sending `/start [param]` and returning chat identity.
- L3: Exposed `POST /api/dialogs/open-bot` in `dialogs.py`.
- L4: Verified with automated unit tests in `test_telegram_open_bot.py` (2/2 passed).
- L5: Added `openBot` in `chatApi.ts` and unified `handleTelegramActionClick` in `ChatsView.tsx`.
- L6: Routed inline button clicks with Telegram bot start links and permalinks to keep user inside the app window without opening external tabs.
- L7: Built frontend (`tsc -b && vite build`) and ran Vitest suite (19 files, 68 tests passing).
- L8: Deployed build to Nginx container and verified live MTProto bot interaction with curl.
