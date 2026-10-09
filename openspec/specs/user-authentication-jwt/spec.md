# Specification: user-authentication-jwt

## Requirement: Email and Password Authentication
The backend MUST provide a secure authentication endpoint `POST /api/auth/login` validating credentials against PostgreSQL using bcrypt and returning a JWT token with user identity and role.

### Scenario: Successful Login
- **Given** an existing active user in PostgreSQL with email `admin@telegramhub.local`,
- **When** the client submits valid credentials to `POST /api/auth/login`,
- **Then** the server returns HTTP 200 with an `access_token`, `token_type: "bearer"`, and the user's role.

### Scenario: Invalid Credentials
- **Given** an invalid password,
- **When** the client submits credentials to `POST /api/auth/login`,
- **Then** the server responds with HTTP 401 Unauthorized without disclosing account existence.
