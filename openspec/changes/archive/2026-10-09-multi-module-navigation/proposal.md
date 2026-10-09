# Change Proposal: multi-module-navigation

## Why
The application is evolving from a single-feature video migration utility into an extensible Telegram Management Hub. Users need to switch seamlessly between different functional modules (Video Migrator, Chat Viewer, and Settings) via an accessible sidebar navigation shell.

## What
1. **Routing Architecture**: Install and configure `react-router-dom` v7 with client-side routing (`BrowserRouter`, `Routes`, `Route`, `Navigate`).
2. **App Shell & Layout**: Implement `AppLayout.tsx` featuring:
   - A persistent, responsive dark-mode Sidebar with active route indicators and Lucide icons.
   - Module routes:
     - `/migration`: The existing `MigrationView` feature.
     - `/chats`: The new `ChatsView` feature placeholder/initial structure with dialog list and message pane.
     - `/settings`: App and session configuration status.
3. **Feature Isolation**: Ensure each feature maintains its own domain, application state (Zustand), and presentation components without coupling.

## Capabilities
- `capability:app-shell-sidebar`: Persistent accessible navigation sidebar with active link highlights and responsive mobile drawer.
- `capability:client-side-routing`: React Router v7 routes configured with clean URL history and fallback redirects.
- `capability:chats-module-scaffolding`: Feature-First module structure for Telegram chat and message viewing.

## Impact & Risks
- **Backward Compatibility**: Visiting `/` redirects cleanly to `/migration`.
- **Nginx SPA Routing**: Already supported via `try_files $uri $uri/ /index.html;` in `frontend/nginx.conf`.
