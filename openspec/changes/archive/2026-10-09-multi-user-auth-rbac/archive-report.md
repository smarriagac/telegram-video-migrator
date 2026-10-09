# Archive Report: multi-user-auth-rbac

- **Date:** 2026-10-09
- **Change Name:** `multi-user-auth-rbac`
- **Status:** Completed & Promoted

## Summary of Accomplishments
1. **Infraestructura PostgreSQL en Docker (Puerto 7902):**
   - Incorporado contenedor `telegram_migrator_postgres` (PostgreSQL 16 Alpine) mapeado a `7902:5432` con volumen persistente y healthcheck.
   - Conexión asíncrona mediante `asyncpg`.
2. **Cifrado de Credenciales en Reposo (AES-256):**
   - Servicio de cifrado reversible AES-256 (Fernet) en `FernetEncryptionService`.
   - Credenciales de Telegram (`api_id`, `api_hash`, `session_string`) almacenadas cifradas en la tabla `telegram_accounts`. En ningún endpoint se exponen los secretos en texto plano.
3. **Autenticación & RBAC:**
   - Entidad `User` con roles enum (`ADMIN`, `OPERATOR`, `VIEWER`).
   - Contraseñas con hashing nativo `bcrypt`.
   - Emisión y validación de tokens JWT (`JwtTokenService`) con claims de rol.
   - Middleware de protección `require_roles([Role.ADMIN])` en FastAPI.
   - Seed automático del administrador inicial: `admin@telegramhub.local` / `admin1234`.
4. **Frontend Clean Architecture:**
   - Módulo `features/auth/` con `LoginView.tsx` (máximo 2 `useState`), `authApi.ts` y `useAuthStore.ts`.
   - Protección de rutas con `<ProtectedRoute allowedRoles={["ADMIN"]} />` en React Router v7.
   - `AppLayout.tsx` con pill de usuario, indicador de rol y botón de logout.
   - Formulario de vinculación de cuentas de Telegram en `SettingsView.tsx` utilizando `FormData` nativo (0 hooks de formulario).
5. **Testing & Validación:**
   - 20/20 tests pasando en pytest (`backend/tests/test_auth_rbac.py`, `test_dialogs.py`, `test_api_endpoints.py`, `test_migration_worker.py`, `test_sqlite_job_repository.py`).
   - Build de producción frontend (`npm run build`) validado con 0 errores.
   - Verificado con curl el login, la consulta de perfil y el guardado de credenciales cifradas en Docker.
