# Feature: Telegram Native Client Experience

Brings authentic Telegram client behavior to the Web Hub: native message forwarding to any dialog/channel, in-message deep link navigation and private invite join flow, full chat/channel/user profile inspection modal, and dynamic chat avatar updating via MTProto.

Delivery strategy: single-pr

## Specs
- S1: Message Forwarding Engine:
  - In `backend/domain/ports/telegram_gateway_port.py` and `telethon_adapter.py`:
    - `forward_messages(source_chat_id: int, target_chat_ids: list[int] | int, message_ids: list[int], account_id: int | None) -> list[int]`.
  - In `backend/presentation/api/routers/dialogs.py`:
    - `POST /api/dialogs/{chat_id}/messages/forward`: forwards messages to target channel(s)/dialog(s).
- S2: Private Invite Links & Deep Link Resolution:
  - In `backend/domain/ports/telegram_gateway_port.py` and `telethon_adapter.py`:
    - `check_chat_invite(invite_url_or_hash: str, account_id: int | None) -> dict[str, Any]`: inspects private/public invite without joining yet.
    - `join_chat_invite(invite_url_or_hash: str, account_id: int | None) -> dict[str, Any]`: joins private invite (`ImportChatInviteRequest`) or public channel (`JoinChannelRequest`).
  - In `backend/presentation/api/routers/dialogs.py`:
    - `POST /api/dialogs/check-invite` and `POST /api/dialogs/join-invite`.
- S3: Full Chat Profile & Metadata Inspection:
  - In `backend/domain/ports/telegram_gateway_port.py` and `telethon_adapter.py`:
    - `get_chat_full_info(chat_id: int, account_id: int | None) -> dict[str, Any]`: extracts description, participant count, pinned message, invite link, permissions.
  - In `backend/presentation/api/routers/dialogs.py`:
    - `GET /api/dialogs/{chat_id}/full-info`.
- S4: Dynamic Chat Photo / Avatar Update:
  - In `backend/domain/ports/telegram_gateway_port.py` and `telethon_adapter.py`:
    - `update_chat_photo(chat_id: int, file_path: str, account_id: int | None) -> bool`.
  - In `backend/presentation/api/routers/dialogs.py`:
    - `POST /api/dialogs/{chat_id}/photo`.
- S5: Frontend Integration & UI Components:
  - In `frontend/src/features/chats/infrastructure/chatApi.ts`: API methods for forward, check/join invite, full info, and photo update.
  - Component `ForwardMessagesModal.tsx`: Searchable channel selector modal to forward single or multiple selected messages.
  - Component `JoinInviteModal.tsx`: Preview private/public invite modal with title, avatar, member count, and "Unirse" action.
  - Component `ChatProfileModal.tsx`: Full chat profile inspection sheet/modal with avatar upload trigger.
  - In `ChatsView.tsx`: Interactive link parsing in message bubbles, header click to open profile, and forward button in message actions bar.
  - Strictly maintain $\le 2$ `useState` hooks per component and use Shadcn primitives.
- S6: Automated Testing & Verification:
  - Automated tests in `backend/tests/test_telegram_client_features.py`.
  - Frontend Vitest suite passing and Vite build passing.
  - Deploy to Docker containers and live verification.

## Tasks
- [x] T1 (S1-S4): Extend `TelegramGatewayPort` and `TelethonAdapter` with forward, check/join invite, full info, and photo update [inline]
- [x] T2 (S1-S4): Expose REST endpoints in `dialogs.py` router [inline]
- [x] T3 (S6): Write backend automated tests in `backend/tests/test_telegram_client_features.py` [inline]
- [x] T4 (S5): Add frontend API methods in `chatApi.ts` [inline]
- [x] T5 (S5): Implement `ForwardMessagesModal.tsx`, `JoinInviteModal.tsx`, and `ChatProfileModal.tsx` [inline]
- [x] T6 (S5): Integrate link parser, forward actions, and profile trigger in `ChatsView.tsx` [inline]
- [x] T7 (S6): Run backend tests and frontend Vitest + Vite build [inline]
- [x] T8 (S6): Deploy to Docker containers and verify live in browser [inline]
- [x] T9 (S6): Mark ODD tasks completed, commit and push [inline]

## Log
- L1: Initialized ODD task for Telegram Native Client Experience.
- L2: Implemented MTProto methods in `TelethonAdapter` and exposed domain ports in `TelegramGatewayPort`.
- L3: Added REST API endpoints for forwarding, invite inspection/joining, profile info, and photo uploading in `dialogs.py`.
- L4: Wrote and executed unit tests in `test_telegram_client_features.py` (5/5 passed).
- L5: Built Shadcn modals (`ForwardMessagesModal`, `JoinInviteModal`, `ChatProfileModal`) obeying the <=2 useState constraint.
- L6: Integrated deep-linking, multi-message forward bar, and profile modal in `ChatsView.tsx`.
- L7: Verified frontend build (Vite/TypeScript) and test suite (19 test files, 68 tests passed).
- L8: Deployed build to Nginx container, restarted backend container, and tested MTProto live endpoints via HTTP.
