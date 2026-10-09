# Technical Design: user-management-rbac

## 1. Domain & Ports
- `UserRepositoryPort`:
  - `async def list_users() -> list[User]`
  - `async def update_user(user_id: int, role: Role | None = None, is_active: bool | None = None) -> User`

## 2. PostgreSQL Implementation
- In `PostgresRepository`:
  - Query: `UPDATE users SET role = COALESCE($1, role), is_active = COALESCE($2, is_active) WHERE id = $3 RETURNING id, email, role, is_active`.

## 3. Application Use Cases
- `ListUsersUseCase(user_repository)`
- `UpdateUserUseCase(user_repository)`: validates that active admin does not self-deactivate.

## 4. API Endpoints in `backend/presentation/api/routers/auth.py`
- `GET /api/auth/users` (Admin only) -> `list[UserResponse]`
- `POST /api/auth/users` (Admin only, already scaffolded) -> `UserResponse`
- `PATCH /api/auth/users/{user_id}` (Admin only) -> `UserResponse`

## 5. Frontend Clean Architecture
- `features/auth/infrastructure/authApi.ts`:
  - `listUsers(token)`
  - `updateUser(token, userId, payload)`
- `features/auth/application/useAuthStore.ts`:
  - State: `usersList: User[]`
  - Actions: `loadUsers()`, `createUser(data)`, `updateUser(id, data)`
- `features/settings/presentation/SettingsView.tsx`:
  - Section "Gestión de Usuarios & Operadores":
    - Card listing users with Email, Role badge (`ADMIN`, `OPERATOR`, `VIEWER`), and Status (Activo/Inactivo).
    - Quick actions: Promover/Degradar rol, Activar/Suspender.
    - Modal or Form to "Crear Nuevo Operador" with native `FormData`.
    - Preserves strict architectural constraint: maximum 2 `useState` hooks.
