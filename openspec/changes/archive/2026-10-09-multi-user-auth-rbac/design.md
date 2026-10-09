# Technical Design: multi-user-auth-rbac

## 1. PostgreSQL Schema Architecture (Port 7902)
Database: `telegram_hub`
Tables:
```sql
CREATE TABLE IF NOT EXISTS roles (
    name VARCHAR(32) PRIMARY KEY,
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL REFERENCES roles(name),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(64),
    api_id_encrypted TEXT NOT NULL,
    api_hash_encrypted TEXT NOT NULL,
    session_string_encrypted TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 2. Cryptographic Security & Secrets Handling
- **Password Hashing:** `passlib` with `bcrypt`.
- **Secrets at Rest:** `cryptography.fernet.Fernet` with `ENCRYPTION_KEY` from `.env`.
- **JWT Signing:** HS256 algorithm with `JWT_SECRET_KEY` and 24h expiration.

## 3. Backend Clean Architecture Layers
- **Domain:**
  - `User`, `Role` (`ADMIN`, `OPERATOR`, `VIEWER`), `TelegramAccount`.
  - Ports: `UserRepositoryPort`, `AccountRepositoryPort`, `EncryptionPort`, `TokenPort`.
- **Infrastructure:**
  - `PostgresUserRepository`, `PostgresAccountRepository` using `asyncpg`.
  - `FernetEncryptionService`.
  - `JwtTokenService`.
- **Application:**
  - `AuthenticateUserUseCase`.
  - `SaveTelegramCredentialsUseCase`.
  - `GetActiveTelegramCredentialsUseCase`.
- **Presentation:**
  - Router `/api/auth` (`/login`, `/me`).
  - Router `/api/settings/credentials`.
  - Dependency `get_current_user` and `require_role(["ADMIN"])`.

## 4. Frontend Clean Architecture
- `features/auth/`:
  - `domain/types.ts`: `User`, `Role`, `AuthResponse`.
  - `application/useAuthStore.ts`: Persisted token in `localStorage`, user state, `login`, `logout`.
  - `presentation/LoginView.tsx`: Clean dark login view with max 2 `useState` hooks.
- `app/ProtectedRoute.tsx`:
  - Wraps routes; if not authenticated, redirects to `/login`.
  - If role insufficient, redirects to default authorized module.
- `app/AppLayout.tsx`:
  - Renders user profile pill with role badge and logout action.
