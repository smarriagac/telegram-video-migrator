# Specifications: real-telegram-dialogs

## Capability: telegram-dialogs-query

### Requirement: List Authenticated User Dialogs
The backend MUST provide an endpoint `GET /api/dialogs` that retrieves Telegram dialogs (direct chats, groups, and channels) with unread counters and last message previews.

#### Scenario: Querying Dialogs with Authorized Client
- **Given** an authorized MTProto session,
- **When** the frontend requests `GET /api/dialogs`,
- **Then** the backend queries `client.iter_dialogs()`,
- **And** returns an array of dialog objects with `id`, `title`, `type`, `unread_count`, and `last_message`.

#### Scenario: Fallback for Unauthorized/Demo Environments
- **Given** an environment without an active Telegram SMS/QR session,
- **When** `GET /api/dialogs` is requested,
- **Then** the endpoint gracefully returns fallback demo dialogs without 500 errors.

---

## Capability: chat-message-history

### Requirement: Fetch Conversation Messages
The backend MUST provide an endpoint `GET /api/dialogs/{chat_id}/messages` returning the recent message history for the specified chat.

#### Scenario: Querying Chat Messages
- **Given** a valid `chat_id`,
- **When** requesting `GET /api/dialogs/{chat_id}/messages?limit=50`,
- **Then** the backend returns messages formatted with `id`, `chat_id`, `sender_id`, `sender_name`, `text`, `date`, and `is_outgoing`.
