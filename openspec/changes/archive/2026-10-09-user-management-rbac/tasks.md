# Tasks: user-management-rbac

## Phase 1: Backend Domain & Use Cases
- [x] 1.1 Update `UserRepositoryPort` and `PostgresRepository` with `update_user` method.
- [x] 1.2 Implement `ListUsersUseCase` and `UpdateUserUseCase`.
- [x] 1.3 Add dependency providers in `backend/presentation/dependencies.py`.

## Phase 2: FastAPI Router Endpoints & Unit Tests
- [x] 2.1 Implement `GET /api/auth/users` and `PATCH /api/auth/users/{user_id}` in `auth.py`.
- [x] 2.2 Create unit tests in `backend/tests/test_user_management.py` and verify via pytest.

## Phase 3: Frontend Integration & Verification
- [x] 3.1 Extend `authApi.ts` with `listUsers` and `updateUser`.
- [x] 3.2 Update `useAuthStore.ts` with `usersList`, `loadUsers`, `createUser`, and `updateUser`.
- [x] 3.3 Add User Management section in `SettingsView.tsx` with role switching and creation form.
- [x] 3.4 Build frontend (`npm run build`) and update Docker containers.
- [x] 3.5 Archive change in OpenSpec and promote canonical specs.
