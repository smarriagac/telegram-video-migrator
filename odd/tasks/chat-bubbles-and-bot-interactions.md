# Feature: Chat Bubbles Refinement, Read-Only Enforcement & Bot Inline Buttons

Refine message bubble ergonomics to match native Telegram proportions (controlled max-width, no redundant sender labels in 1-on-1 chats, bottom-right timestamps). Enforce read-only input locking when posting is disabled (`can_post: false`), and enable interactive Telegram bot inline buttons (`reply_markup`).

Delivery strategy: single-pr

## Specs
- S1: Message Bubble UI & Layout Refinement (`ChatsView.tsx`):
  - Constrain message bubble width to `max-w-[85%] sm:max-w-[75%] md:max-w-[65%]` with `w-fit`.
  - Suppress sender name header on outgoing messages and in private/user/bot chats (only render in multi-user groups).
  - Shape bubbles with distinct incoming (`rounded-2xl rounded-tl-xs`) and outgoing (`rounded-2xl rounded-tr-xs`) corners and colors.
  - Position time and checkmarks at bottom-right inside the bubble.
- S2: Read-Only Channel & Group Enforcement (`ChatsView.tsx`):
  - Check `activeChat.can_post === false` before rendering the message input bar.
  - When posting is disabled, render locked banner: `🔒 Canal de solo lectura. No tenés permisos para publicar mensajes.`
  - Prevent accidental submissions and disable paperclip/send buttons.
- S3: Bot Inline Keyboard Interactions (`reply_markup`):
  - Extend `ChatMessage` and `ChatMessageResponse` with `buttons: list[list[dict]] | None`.
  - In `telethon_adapter.py`: extract `m.buttons` (text, url, has_callback).
  - Add `POST /api/dialogs/{chat_id}/messages/{message_id}/click-button` in `dialogs.py`.
  - In `ChatsView.tsx`: render inline button grid below bot message bubbles. URL buttons open link; callback buttons invoke click endpoint and refresh active messages.
- S4: Architectural Constraints:
  - Maintain strictly maximum 2 `useState` hooks in `ChatsView.tsx`.
- S5: Automated Tests & Verification:
  - Backend tests verifying `buttons` extraction in `ChatMessageResponse` and read-only dialog states.

## Tasks
- [x] T1 (S1, S2): Refactor message bubbles and read-only locked bar in `ChatsView.tsx` within 2-hook budget [inline]
- [x] T2 (S3): Add `buttons` field to `ChatMessage` entity, schema, and `telethon_adapter.py` [inline]
- [x] T3 (S3): Implement click-button endpoint in `dialogs.py` and `telethon_adapter.py` [inline]
- [x] T4 (S5): Write automated backend tests in `backend/tests/test_dialogs.py` [inline]
- [x] T5 (S3): Render interactive bot inline buttons in `ChatsView.tsx` [inline]
- [x] T6 (S5): Compile frontend bundle and deploy to Docker container [inline]
- [x] T7 (S5): Run full pytest test suite [inline]
- [x] T8 (S5): Git commit and push with conventional commit message [inline]

## Log
- L1: User reported that message bubbles stretched too wide and that channels/bots with interactions/buttons lacked clickable controls.
- L2: User requested locking the send input bar when sending is disabled (read-only channels).
- L3: Constrained message bubbles to Telegram-style proportions (`max-w-[65%] w-fit`), hid redundant sender labels in private/bot chats and outgoing messages, and aligned timestamp with read receipts.
- L4: Enforced read-only locking on `activeChat.can_post === false` replacing input form with locked security banner.
- L5: Extracted Telegram bot inline keyboard markup (`reply_markup.rows`) and added `POST /api/dialogs/{chat_id}/messages/{message_id}/click-button` to enable interactive bot shopping/command callbacks.
- L6: All 113 automated tests passed cleanly.
