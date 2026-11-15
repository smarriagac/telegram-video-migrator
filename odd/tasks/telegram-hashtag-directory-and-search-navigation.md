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

## Tasks
- [x] T1 (S1): Add `extract_chat_hashtags` and `search_query` in port, adapter, and router [inline]
- [x] T2 (S2): Write automated tests in `test_telegram_hashtags.py` and run pytest [inline]
- [x] T3 (S3): Add `ChatHashtagInfo` in `types.ts` and `fetchChatHashtags` in `chatApi.ts` [inline]
- [x] T4 (S4): Implement `HashtagDirectoryModal.tsx` with Shadcn UI and $\le 2$ `useState` hooks [inline]
- [x] T5 (S4): Integrate hashtag detection, in-chat search bar, and smooth navigation in `ChatsView.tsx` [inline]
- [x] T6 (S5): Run full test suite, compile frontend build, deploy to Docker and verify live [inline]
- [x] T7 (S5): Complete ODD logbook, commit and push [inline]

## Log
- L1: Initialized ODD task for Telegram Hashtag Directory Generator & In-Chat Navigation.
- L2: Implemented domain port, telethon adapter extraction regex `#([a-zA-Z0-9_ñáéíóúÁÉÍÓÚ]+)`, and dialogs REST router.
- L3: Added unit tests in `backend/tests/test_telegram_hashtags.py` and resolved backward compatibility with `GetChatMessagesUseCase`.
- L4: Implemented `ChatHashtagInfo` domain types and `chatApi.fetchChatHashtags`.
- L5: Built `HashtagDirectoryModal.tsx` strictly abiding by $\le 2$ `useState` hooks and using Shadcn UI dialog, textarea, and badges.
- L6: Integrated `# Índice` header button, clickable interactive `#hashtag` token parsing, in-chat navigation bar (`X de Y`, `[▲]`, `[▼]`, `[✕]`), and smooth scroll centering with pulsing highlight.
- L7: Frontend and backend test suites passed 100%. Built and deployed to Docker containers.
