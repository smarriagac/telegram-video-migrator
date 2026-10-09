# Tasks: multi-module-navigation

## Phase 1: Routing & Shell Layout
- [x] 1.1 Install `react-router-dom` v7 in `frontend/`.
- [x] 1.2 Implement `AppLayout.tsx` with dark sidebar navigation, active highlights, and `<Outlet />`.
- [x] 1.3 Configure routes in `frontend/src/app/App.tsx` (`/migration`, `/chats`, `/settings`).

## Phase 2: Chats & Settings Module Scaffolding
- [x] 2.1 Scaffold `frontend/src/features/chats/` with domain types, `useChatStore.ts`, and `ChatsView.tsx`.
- [x] 2.2 Scaffold `frontend/src/features/settings/presentation/SettingsView.tsx`.

## Phase 3: Verification & Deployment
- [x] 3.1 Verify frontend production build (`npm run build`).
- [x] 3.2 Rebuild and verify Docker container on `http://localhost:7900`.
- [x] 3.3 Archive change in OpenSpec and promote canonical specs.
