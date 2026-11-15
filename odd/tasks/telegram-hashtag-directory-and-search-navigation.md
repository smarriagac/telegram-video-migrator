# Feature: Telegram Hashtag Directory Generator & In-Chat Navigation

Adds an in-chat option to scan chat history, generate an interactive #hashtag index/directory message, and makes all #hashtags clickable in messages to filter and jump directly between matching messages with prev/next navigation.

Delivery strategy: single-pr

## Specs
- S1: Backend Hashtags Discovery & History Search:
  - In `backend/domain/ports/telegram_gateway_port.py`:
    - `extract_chat_hashtags(chat_id: int, limit: int = 200, account_id: int | None = None) -> dict[str, Any]`
    - Update `get_chat_messages` with optional `search_query: str | None = None`.
  - In `backend/infrastructure/telegram/telethon_adapter.py`:
    - Regex extraction of `#([a-zA-Z0-9_ñáéíóúÁÉÍÓÚ]+)` across messages and rich messages.
    - Support `search=query` parameter in Telethon `iter_messages`.
  - In `backend/presentation/api/routers/dialogs.py`:
    - `GET /api/dialogs/{chat_id}/hashtags`
    - Add `query: str | None = Query(None)` to `GET /api/dialogs/{chat_id}/messages`.
- S2: Backend Automated Tests:
  - In `backend/tests/test_telegram_hashtags.py`: test hashtag discovery, template formatting, and search query passing.
- S3: Frontend API & Types:
  - In `types.ts` and `chatApi.ts`: add `ChatHashtagInfo` and `fetchChatHashtags`.
- S4: Frontend Directory Modal & Clickable Hashtags:
  - Component `HashtagDirectoryModal.tsx` (using Shadcn UI, strictly $\le 2$ `useState` hooks):
    - Displays detected tags with counts.
    - Editable template preview with emojis and structured links.
    - Actions: "Publicar en chat", "Copiar", "Cargar en borrador".
  - In `ChatsView.tsx`:
    - Header action button for `# Índice`.
    - Update `renderFormattedMessageText` to recognize `#hashtag` as clickable filter pills.
    - In-chat filter navigation bar (`X de Y`, `[▲]`, `[▼]`, `[✕]`) with smooth scroll and highlight flash.
    - Strictly maintain $\le 2$ `useState` hooks in `ChatsView.tsx`.
- S5: Testing, Build & Container Deployment:
  - Vitest + Vite build in `frontend/`.
  - Pytest in Docker `telegram_migrator_backend`.
  - Deploy to Docker containers and test live.
- S6: Full History Channel Scan Depth (`limit=0` / Unbounded):
  - In `dialogs.py`: allow `limit: int = Query(500, ge=0, le=50000)` where `0` designates a full channel history scan.
  - In `telethon_adapter.py`: when `limit <= 0`, pass `limit=None` to `iter_messages` so channels with >1,000 messages (e.g. 1,443 messages) are scanned in full.
  - In `HashtagDirectoryModal.tsx`: add `Todo el canal` depth preset chip and display status message accordingly.
- S7: UTF-16 Entity Offset Safety & Regex Sanitization:
  - Slicing `text.encode('utf-16-le')` prevents index drift caused by 4-byte emojis (`🔥`, `🔞`, `✨`).
  - Strict regex post-filter `^#[a-zA-Z0-9_\u00C0-\u017F\u0400-\u04FF]+$` guarantees zero dirty tags with spaces, newlines, or trailing symbols.
- S8: Directory Format Styles & Customization:
  - Implement 3 directory message layout styles:
    1. `Popularidad`: Decreasing order by post frequency with count indicator.
    2. `Alfabético A-Z`: Grouped by letter initial into alphabetical sections (`📁 **A**`, `📁 **B**`...).
    3. `Nube Compacta`: Ultra-compact inline cloud separated by `•` bullets.
  - Add switch toggle for publication counts (`Cantidades: Sí / No`).
  - Add `10k` to depth presets list (`200`, `500`, `1k`, `2.5k`, `5k`, `10k`, `Todo el canal`).
  - Abide by strictly $\le 2$ `useState` hooks in `HashtagDirectoryModal.tsx`.

## Tasks
- [x] T1 (S1): Add `extract_chat_hashtags` and `search_query` in port, adapter, and router [inline]
- [x] T2 (S2): Write automated tests in `test_telegram_hashtags.py` and run pytest [inline]
- [x] T3 (S3): Add `ChatHashtagInfo` in `types.ts` and `fetchChatHashtags` in `chatApi.ts` [inline]
- [x] T4 (S4): Implement `HashtagDirectoryModal.tsx` with Shadcn UI and $\le 2$ `useState` hooks [inline]
- [x] T5 (S4): Integrate hashtag detection, in-chat search bar, and smooth navigation in `ChatsView.tsx` [inline]
- [x] T6 (S5): Run full test suite, compile frontend build, deploy to Docker and verify live [inline]
- [x] T7 (S5): Complete ODD logbook, commit and push [inline]
- [x] T8 (S6): Add full channel scan depth (`limit=0`) in adapter and dialogs router [inline]
- [x] T9 (S7): Implement UTF-16 byte slicing and regex sanitization in `extract_chat_hashtags` [inline]
- [x] T10 (S6, S7): Add unit tests in `test_telegram_hashtags.py`, update modal with "Todo el canal" preset, test live on channel ID `-1004337257363` (1,443 messages -> 85 clean tags) [inline]
- [x] T11 (S8): Implement `DirectoryLayoutStyle` ("popularity" | "alphabetical" | "compact") and counts toggle in `buildDirectoryMessage` and `HashtagDirectoryModal.tsx` [inline]
- [x] T12 (S8): Add component unit tests for layout switching and counts toggle, build and verify live [inline]

## Log
- L1: Initialized ODD task for Telegram Hashtag Directory Generator & In-Chat Navigation.
- L2: Implemented domain port, telethon adapter extraction regex `#([a-zA-Z0-9_ñáéíóúÁÉÍÓÚ]+)`, and dialogs REST router.
- L3: Added unit tests in `backend/tests/test_telegram_hashtags.py` and resolved backward compatibility with `GetChatMessagesUseCase`.
- L4: Implemented `ChatHashtagInfo` domain types and `chatApi.fetchChatHashtags`.
- L5: Built `HashtagDirectoryModal.tsx` strictly abiding by $\le 2$ `useState` hooks and using Shadcn UI dialog, textarea, and badges.
- L6: Integrated `# Índice` header button, clickable interactive `#hashtag` token parsing, in-chat navigation bar (`X de Y`, `[▲]`, `[▼]`, `[✕]`), and smooth scroll centering with pulsing highlight.
- L7: Frontend and backend test suites passed 100%. Built and deployed to Docker containers.
- L8: Discovered that default depth (1,000 msgs) truncated channels with larger histories (e.g. `Prueba 2.0 - reenvio` has 1,443 messages), and Telegram MTProto `MessageEntityHashtag` offsets in UTF-16 caused index drift across emojis resulting in dirty tags (`#Escorcia #val`, `#agarcia y de`, `#r 🔥🔥🔥😈`).
- L9: Implemented UTF-16 byte slicing, regex sanitization, and `limit=0` for full channel scans. Added preset "Todo el canal". Verified live on channel `-1004337257363` extracting 85 clean unique hashtags across 1,443 messages with 0 dirty tags.
- L10: Enhanced directory generator with 3 customizable layouts (Popularidad, Alfabético A-Z con carpetas, Nube Compacta) and dynamic toggle for publication counts. Added 10k depth preset.
