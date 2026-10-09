# Tasks: multi-user-auth-rbac

## Phase 1: Infrastructure & Dependencies
- [x] 1.1 Add PostgreSQL 16 container to `docker-compose.yml` on port `7902:5432` with healthcheck.
- [x] 1.2 Add `asyncpg`, `cryptography`, `pyjwt`, `passlib[bcrypt]` to `backend/requirements.txt` and `pyproject.toml`.

## Phase 2: Backend Domain, Security & Repositories
- [x] 2.1 Create domain entities (`User`, `Role`, `TelegramAccount`) and ports.
- [x] 2.2 Implement `FernetEncryptionService` and `JwtTokenService`.
- [x] 2.3 Implement PostgreSQL repository with schema initialization and default admin seed (`admin@telegramhub.local`).
- [x] 2.4 Implement application use cases (`AuthenticateUserUseCase`, `SaveTelegramCredentialsUseCase`).

## Phase 3: FastAPI Endpoints & RBAC Protection
- [x] 3.1 Implement `/api/auth` router (`/login`, `/me`) and role verification dependencies.
- [x] 3.2 Implement `/api/settings/credentials` router with encryption and role checks.
- [x] 3.3 Add unit and integration tests in `backend/tests/test_auth_rbac.py` and verify via pytest.

## Phase 4: Frontend Authentication, RBAC & Settings
- [x] 4.1 Scaffold `frontend/src/features/auth/` (domain, `useAuthStore`, `authApi`, `LoginView.tsx`).
- [x] 4.2 Implement `ProtectedRoute.tsx` and integrate routes in `App.tsx`.
- [x] 4.3 Update `AppLayout.tsx` with user profile, role badge, and logout.
- [x] 4.4 Update `SettingsView.tsx` with Telegram credential management form.

## Phase 5: Build, Deployment & SDD Archive
- [x] 5.1 Run `npm run build` and pytest suites.
- [x] 5.2 Rebuild and verify all 3 Docker services (7900 frontend, 7901 backend, 7902 postgres).
- [x] 5.3 Archive change in OpenSpec and promote canonical specs.
