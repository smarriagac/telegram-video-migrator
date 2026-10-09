# Change: Interactive User & RBAC Management

## Context & Motivation
Actualmente existe un usuario administrador inicial sembrado en PostgreSQL (`admin@telegramhub.local`). Para delegar la operación del migrador y la lectura de chats a terceros sin compartir credenciales maestras, los administradores deben poder dar de alta usuarios interactivos, asignar roles de ejecución (`ADMIN`, `OPERATOR`, `VIEWER`), consultar el listado de accesos y alternar el estado activo/inactivo de las cuentas desde el dashboard.

## Proposed Change
1. **Dominio & Casos de Uso (Backend)**:
   - Extender `UserRepositoryPort` con `update_user(user_id, role, is_active)` y `delete_user(user_id)`.
   - Implementar métodos en `PostgresRepository`.
   - Crear casos de uso: `ListUsersUseCase`, `UpdateUserUseCase`.
2. **API (FastAPI)**:
   - Endpoint `GET /api/auth/users`: Lista completa de usuarios protegida para rol `ADMIN`.
   - Endpoint `PATCH /api/auth/users/{user_id}`: Modificación de rol y estado activo, con validación que impide al administrador desactivarse a sí mismo.
3. **Frontend Clean Architecture**:
   - Métodos en `authApi.ts` (`listUsers`, `updateUserRole`, `toggleUserActive`).
   - Acciones en `useAuthStore.ts` (`usersList`, `loadUsers`, `updateUser`).
   - Sección de gestión en `SettingsView.tsx` con listado de operadores, selector de rol y alta interactiva con `FormData` nativo (máximo 2 `useState`).
4. **Verificación & Pruebas**:
   - Pruebas unitarias en `backend/tests/test_user_management.py`.
   - Verificación de build y pruebas end-to-end con Docker.

## Capabilities Affected
- `user-management-admin` (Nueva)
- `role-assignment-lifecycle` (Nueva)
