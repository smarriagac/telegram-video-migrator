# Specification: chat-message-history

## Requirement: Fetch Conversation Messages
The backend MUST provide an endpoint `GET /api/dialogs/{chat_id}/messages` returning the recent message history for the specified chat.

### Scenario: Querying Chat Messages
- **Given** a valid `chat_id`,
- **When** requesting `GET /api/dialogs/{chat_id}/messages?limit=50`,
- **Then** the backend returns messages formatted with `id`, `chat_id`, `sender_id`, `sender_name`, `text`, `date`, and `is_outgoing`.
