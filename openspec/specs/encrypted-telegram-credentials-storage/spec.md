# Specification: encrypted-telegram-credentials-storage

## Requirement: Encryption At Rest for Telegram Secrets
Telegram API ID, API Hash, and Session strings stored in PostgreSQL MUST be encrypted at rest using AES-256 (Fernet) and decrypted only in memory when initializing the MTProto gateway.

### Scenario: Storing Credentials
- **Given** an administrator submitting Telegram credentials,
- **When** saving via `POST /api/settings/credentials`,
- **Then** the raw secret bytes are encrypted using the application master key before writing to the database,
- **And** raw secrets are never returned in cleartext in API query responses.
