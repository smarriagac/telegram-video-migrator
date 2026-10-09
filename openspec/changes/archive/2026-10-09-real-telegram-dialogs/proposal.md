# Change: Real Telegram Dialogs & Message History via MTProto

## Context & Motivation
El Telegram Hub actualmente cuenta con la vista de `/chats` en el frontend, pero esta se alimenta de datos mockeados en memoria. Para convertirlo en un módulo funcional de administración de Telegram, el sistema debe conectarse a través del gateway MTProto (Telethon) para consultar los diálogos reales del usuario (usuarios, grupos y canales) y obtener el historial de mensajes de cualquier conversación seleccionada, con fallback seguro en entornos de desarrollo sin sesión activa.

## Proposed Change
1. **Dominio & Puertos**:
   - Agregar entidad `TelegramDialog` (id, title, type: user/group/channel, unread_count, last_message, last_message_date) y `ChatMessage` (id, chat_id, sender_id, sender_name, text, date, is_outgoing).
   - Extender `TelegramGatewayPort` con `get_dialogs(limit: int)` y `get_chat_messages(chat_id: int, limit: int)`.
2. **Infraestructura**:
   - Implementar `get_dialogs` y `get_chat_messages` en `TelethonAdapter` con llamadas reales a `client.iter_dialogs()` y `client.iter_messages()`.
   - Manejo de excepciones de MTProto (`FloodWaitError`, errores de permisos).
3. **Casos de Uso**:
   - `GetDialogsUseCase` y `GetChatMessagesUseCase`.
4. **Capa de Presentación API (FastAPI)**:
   - Nuevo router `/api/dialogs` con endpoints:
     - `GET /api/dialogs`
     - `GET /api/dialogs/{chat_id}/messages`
5. **Capa Frontend**:
   - `chatApi.ts` para consumir `/api/dialogs` y `/api/dialogs/{chat_id}/messages`.
   - Conectar `useChatStore` para cargar los diálogos al montar y mensajes al seleccionar un chat.
   - Preservar la regla estricta: máximo 2 `useState` en la vista `ChatsView`.

## Capabilities Affected
- `telegram-dialogs-query` (Nueva)
- `chat-message-history` (Nueva)
