# Tasks: real-telegram-dialogs

## Phase 1: Backend Domain & Use Cases
- [x] 1.1 Create domain entities in `backend/domain/entities/dialog.py` and `backend/domain/entities/chat_message.py`.
- [x] 1.2 Extend `TelegramGatewayPort` with `get_dialogs` and `get_chat_messages`.
- [x] 1.3 Implement methods in `TelethonAdapter`.
- [x] 1.4 Create `GetDialogsUseCase` and `GetChatMessagesUseCase`.

## Phase 2: FastAPI Endpoints & Tests
- [x] 2.1 Create router `backend/presentation/api/routers/dialogs.py` and mount in `backend/main.py`.
- [x] 2.2 Add unit tests in `backend/tests/test_dialogs.py` and verify via pytest.

## Phase 3: Frontend Integration & Verification
- [x] 3.1 Create `frontend/src/features/chats/infrastructure/chatApi.ts`.
- [x] 3.2 Update `frontend/src/features/chats/application/useChatStore.ts` with async loading.
- [x] 3.3 Connect `ChatsView.tsx` with `useEffect` (preserving max 2 `useState` constraint).
- [x] 3.4 Build frontend (`npm run build`) and update Docker containers.
- [x] 3.5 Archive change in OpenSpec and promote specs.
