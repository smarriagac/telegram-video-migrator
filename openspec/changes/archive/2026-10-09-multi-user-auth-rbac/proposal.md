# Change: Multi-User Auth, Role-Based Access Control (RBAC), and Encrypted Telegram Credentials

## Context & Motivation
El dashboard de Telegram Hub necesita soportar múltiples operadores con distintos niveles de privilegio para restringir el acceso a módulos críticos (como el clonador de videos o la configuración de API) y permitir la gestión segura de credenciales de Telegram desde la interfaz gráfica.

Para evitar riesgos de seguridad severos, las credenciales de Telegram (`api_id`, `api_hash`, `session_string`) deben almacenarse cifradas en reposo con AES-256. Además, se incorpora PostgreSQL en el puerto `7902` como motor relacional transaccional para la gestión de usuarios, roles y cuentas, preservando la arquitectura hexagonal limpia.

## Proposed Change
1. **Infraestructura Docker**:
   - Agregar servicio `postgres` (PostgreSQL 16 Alpine) en `docker-compose.yml` mapeado al puerto `7902:5432` con volumen persistente y healthcheck.
   - Conectar el backend a PostgreSQL mediante `asyncpg`.
2. **Dominio & Seguridad**:
   - Entidades `User` (id, email, password_hash, role, is_active) y roles enum (`ADMIN`, `OPERATOR`, `VIEWER`).
   - Entidad `TelegramAccount` (id, name, api_id_enc, api_hash_enc, session_enc, is_active).
   - Puertos para `UserRepositoryPort`, `TelegramAccountRepositoryPort`, `EncryptionPort` y `TokenPort`.
   - Servicio de cifrado reversible AES-256 (Fernet) para credenciales de Telegram.
3. **Casos de Uso & API**:
   - `LoginUseCase` y verificación de contraseñas con bcrypt.
   - Endpoint `/api/auth/login` y `/api/auth/me` con JWT.
   - Endpoint `/api/settings/credentials` protegido para rol `ADMIN`.
   - Middleware/Dependencia `require_roles([...])` en FastAPI.
4. **Frontend**:
   - Módulo `features/auth/` con `useAuthStore`, `authApi` y `LoginView.tsx` (máximo 2 `useState`).
   - Ruta protegida y control de acceso en React Router v7.
   - Visualización de rol del usuario y botón de cierre de sesión en `AppLayout.tsx`.
   - Formulario seguro de carga de credenciales en `SettingsView.tsx`.

## Capabilities Affected
- `user-authentication-jwt` (Nueva)
- `role-based-access-control` (Nueva)
- `encrypted-telegram-credentials-storage` (Nueva)
- `postgres-persistence` (Nueva)
