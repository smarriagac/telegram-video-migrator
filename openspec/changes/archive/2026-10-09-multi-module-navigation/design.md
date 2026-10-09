# Technical Design: multi-module-navigation

## 1. Routing Architecture

Using `react-router-dom` v7:
```text
App.tsx (BrowserRouter)
 └── AppLayout
      ├── Sidebar (NavLinks: /migration, /chats, /settings)
      └── Main Content (<Outlet />)
           ├── Route path="/migration" -> <MigrationView />
           ├── Route path="/chats"     -> <ChatsView />
           ├── Route path="/settings"  -> <SettingsView />
           └── Route path="*"          -> <Navigate to="/migration" replace />
```

## 2. Directory Structure Update
```text
frontend/src/
├── app/
│   ├── App.tsx             # BrowserRouter + Routes definition
│   ├── AppLayout.tsx       # Sidebar + Header + Outlet shell
│   └── routes.tsx          # Centralized route constants
└── features/
    ├── migration/          # Existing migration module (unchanged)
    ├── chats/              # New chats module scaffolding
    │   ├── domain/types.ts
    │   ├── application/useChatStore.ts
    │   └── presentation/ChatsView.tsx
    └── settings/           # Settings module
        └── presentation/SettingsView.tsx
```

## 3. Accessibility & A11y Standards
- Sidebar navigation wrapped in `<nav aria-label="Navegación principal">`.
- Active NavLink exposes `aria-current="page"`.
- Mobile responsiveness: togglable sidebar on small screens.
