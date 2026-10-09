# Specification: telegram-session-auth

## Requirement: Telegram MTProto Authentication
The system MUST authenticate against the Telegram MTProto API using the user's `api_id`, `api_hash`, and a persistent session (file or `StringSession`). The gateway must support hot-swapping credentials stored in PostgreSQL, headless Docker execution without terminal stalls, and interactive command-line login.

### Scenario: Active Session Connected from Database
- **Given** an active Telegram account configured in PostgreSQL with decrypted `api_id`, `api_hash`, and `session_string`,
- **When** the backend client initializes via `get_telegram_gateway`,
- **Then** the client connects to Telegram and verifies the user is authorized without needing environment variable overrides.

### Scenario: Interactive CLI Login & Session Export
- **Given** an operator running `scripts/login_telegram.py`,
- **When** the user provides `api_id`, `api_hash`, phone number, and SMS/Telegram verification code (including 2FA password if enabled),
- **Then** Telethon authenticates the account, saves an exported `StringSession`, and provides options to save to `.env` or paste into the web Settings UI.

### Scenario: Dynamic Hot-Swap upon Credential Update
- **Given** an administrator updating Telegram credentials in the Settings view (`POST /api/settings/credentials`),
- **When** subsequent MTProto operations (channel listing, migration, dialogs) execute,
- **Then** the client factory reconfigures in-memory to use the newly provided credentials without restarting backend containers.

### Scenario: Missing or Unauthorized Session Graceful Fallback
- **Given** missing credentials or an unauthorized session,
- **When** the backend channels or dialogs endpoints are queried,
- **Then** the endpoints return a structured preview payload with diagnostic warnings rather than crashing the API or worker.
