# Feature: Telegram Rich Messages & Button Links Extraction

Fixes rendering of Telegram messages that lack plain `message` text by parsing Telegram's modern `rich_message` payload (tables, headings, paragraphs, lists), handling service messages (`MessageService`), resolving inline button URLs from `KeyboardInlineButton.type.url`, and rendering markdown bold tags in `ChatsView.tsx`.

Delivery strategy: single-pr

## Specs
- S1: Backend Message Text Extraction Engine:
  - In `backend/infrastructure/telegram/telethon_adapter.py`:
    - Implement `_extract_rich_text(rt)` and `_extract_message_text(msg)`:
      - Extracts plain text if `msg.message` exists.
      - Traverses `msg.rich_message.blocks` (`PageBlockHeading`, `PageBlockTable`, `PageBlockParagraph`, `PageBlockList`) and converts tables/receipts into readable markdown.
      - Translates `MessageService` actions (pin, join by link, edit photo/title).
      - Identifies special media (`MessageMediaPoll`, `MessageMediaContact`, `MessageMediaGeo`, `MessageMediaDice`).
    - Fix button URL extraction in `get_chat_messages` and `resolve_message_link`:
      - Inspect `b.url` as well as `b.type.url` on `KeyboardInlineButton`.
- S2: Dialogs `last_message` preview:
  - In `telethon_adapter.py`'s `get_dialogs`: use `_extract_message_text` to show meaningful previews instead of generic `[Archivo/Foto]` for rich/bot messages.
- S3: Backend Automated Tests:
  - In `backend/tests/test_telegram_rich_messages.py`:
    - Test rich message table and heading parsing.
    - Test button URL extraction for `InlineButtonTypeUrl`.
    - Test service actions and poll fallback text.
- S4: Frontend Markdown & Bubble Polishing:
  - In `frontend/src/features/chats/presentation/ChatsView.tsx`:
    - Enhance `renderFormattedMessageText` to render `**bold**` markdown tags.
    - Prevent empty ghost bubbles if text and media are both empty.
- S5: Build, Test & Live Verification:
  - Vitest + Vite build in `frontend/`.
  - Pytest in Docker `telegram_migrator_backend`.
  - Deploy to Docker containers and test live.

## Tasks
- [x] T1 (S1-S2): Implement `_extract_message_text` and fix button URLs in `telethon_adapter.py` [inline]
- [x] T2 (S3): Write automated tests in `test_telegram_rich_messages.py` and run pytest [inline]
- [x] T3 (S4): Add basic markdown bold rendering to `renderFormattedMessageText` in `ChatsView.tsx` [inline]
- [x] T4 (S5): Run vitest, compile frontend build, deploy to containers, and verify live [inline]
- [x] T5 (S5): Complete ODD logbook, commit and push [inline]

## Log
- L1: Initialized ODD task for Telegram Rich Messages & Button Links.
- L2: Diagnosed message rendering issue in `Asha Store Channel`: messages with `rich_message` (e-commerce purchase receipts and confirmation tables) have empty `m.message`.
- L3: Implemented recursive `_extract_rich_text` and `_extract_message_text` in `TelethonAdapter`, translating PageBlockHeadings, PageBlockTables, PageBlockLists, service actions, and polls into markdown.
- L4: Fixed inline keyboard button URL resolution to inspect `b.type.url` on `KeyboardInlineButton`.
- L5: Added automated test suite `test_telegram_rich_messages.py` (5/5 tests passed).
- L6: Added markdown bold `**...**` tag rendering in `ChatsView.tsx`'s `renderFormattedMessageText`.
- L7: Built and verified frontend (Vite + Vitest 68/68 passed).
- L8: Deployed to Docker and verified live message extraction in channel `-1004417196757`.
