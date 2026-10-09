# Specification: encrypted-telegram-credentials-storage

## Requirement: Encryption At Rest for Telegram Secrets
Telegram API ID, API Hash, and Session strings stored in PostgreSQL MUST be encrypted at rest using AES-256 (Fernet) and decrypted only in memory when initializing the MTProto gateway.

### Scenario: Storing Credentials
- **Given** an administrator submitting Telegram credentials,
- **When** saving via `POST /api/settings/credentials`,
- **Then** the raw secret bytes are encrypted using the application master key before writing to the database,
- **And** raw secrets are never returned in cleartext in API query responses.

### Scenario: Dynamic In-Memory Decryption and Client Reconfiguration
- **Given** an active encrypted Telegram credential set stored in PostgreSQL,
- **When** the MTProto gateway is requested via dependency injection (`get_telegram_gateway`),
- **Then** the credential repository decrypts the API ID, API Hash, and StringSession in memory using the master key,
- **And** reconfigures the global Telegram client factory without exposing raw secrets to disk or requiring a container restart.
