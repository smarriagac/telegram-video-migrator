# Technical Design: real-telegram-dialogs

## 1. Domain Entities
- `TelegramDialog`:
  - `id: int`
  - `title: str`
  - `type: str` ("user" | "group" | "channel")
  - `unread_count: int`
  - `last_message: str | None`
  - `last_message_date: str | None`
  - `avatar_color: str | None`
- `ChatMessage`:
  - `id: int`
  - `chat_id: int`
  - `sender_id: int`
  - `sender_name: str`
  - `text: str`
  - `date: str`
  - `is_outgoing: bool`

## 2. Ports & Telethon Adapter
- `TelegramGatewayPort`:
  - `async def get_dialogs(limit: int = 50) -> list[TelegramDialog]`
  - `async def get_chat_messages(chat_id: int, limit: int = 50) -> list[ChatMessage]`
- `TelethonAdapter`:
  - Uses `client.iter_dialogs(limit=limit)` inspecting `dialog.is_user`, `dialog.is_group`, `dialog.is_channel`.
  - Uses `client.iter_messages(chat_id, limit=limit)` formatting dates and sender names.

## 3. Use Cases
- `GetDialogsUseCase`: delegates to `TelegramGatewayPort.get_dialogs`.
- `GetChatMessagesUseCase`: delegates to `TelegramGatewayPort.get_chat_messages`.

## 4. API Endpoints
- `GET /api/dialogs`
- `GET /api/dialogs/{chat_id}/messages`

## 5. Frontend Clean Architecture
- `features/chats/infrastructure/chatApi.ts`:
  - `fetchDialogs(): Promise<Chat[]>`
  - `fetchMessages(chatId: number): Promise<Message[]>`
- `features/chats/application/useChatStore.ts`:
  - `loadDialogs(): Promise<void>`
  - `selectChat(chatId: number): Promise<void>` (fetches messages if not cached)
- `features/chats/presentation/ChatsView.tsx`:
  - Loads dialogs on mount via `useEffect`.
  - Max 2 `useState` hooks constraint preserved.
