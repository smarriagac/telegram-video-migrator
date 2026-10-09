# Specifications: multi-user-auth-rbac

## Capability: user-authentication-jwt

### Requirement: Email and Password Authentication
The backend MUST provide a secure authentication endpoint `POST /api/auth/login` validating credentials against PostgreSQL using bcrypt and returning a JWT token with user identity and role.

#### Scenario: Successful Login
- **Given** an existing active user in PostgreSQL with email `admin@telegramhub.local`,
- **When** the client submits valid credentials to `POST /api/auth/login`,
- **Then** the server returns HTTP 200 with an `access_token`, `token_type: "bearer"`, and the user's role.

#### Scenario: Invalid Credentials
- **Given** an invalid password,
- **When** the client submits credentials to `POST /api/auth/login`,
- **Then** the server responds with HTTP 401 Unauthorized without disclosing account existence.

---

## Capability: role-based-access-control

### Requirement: RBAC Route and Endpoint Protection
Endpoints and client views MUST enforce access restrictions based on the user's assigned role (`ADMIN`, `OPERATOR`, `VIEWER`).

#### Scenario: Admin Only Operation
- **Given** an authenticated user with role `OPERATOR`,
- **When** they attempt to modify Telegram API credentials via `POST /api/settings/credentials`,
- **Then** the backend rejects the request with HTTP 403 Forbidden.

#### Scenario: Module Visibility
- **Given** an authenticated user with role `VIEWER`,
- **When** viewing the sidebar,
- **Then** administrative configuration actions are restricted.

---

## Capability: encrypted-telegram-credentials-storage

### Requirement: Encryption At Rest for Telegram Secrets
Telegram API ID, API Hash, and Session strings stored in PostgreSQL MUST be encrypted at rest using AES-256 (Fernet) and decrypted only in memory when initializing the MTProto gateway.

#### Scenario: Storing Credentials
- **Given** an administrator submitting Telegram credentials,
- **When** saving via `POST /api/settings/credentials`,
- **Then** the raw secret bytes are encrypted using the application master key before writing to the database,
- **And** raw secrets are never returned in cleartext in API query responses.
