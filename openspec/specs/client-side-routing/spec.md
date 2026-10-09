# Specification: client-side-routing

## Requirement: React Router v7 Root Navigation
The application MUST route users between modules using React Router v7 with browser history support and SPA fallback.

### Scenario: Default Route Redirection
- **Given** the user navigates to root `/`,
- **When** the router evaluates the path,
- **Then** it automatically redirects to `/migration`.

### Scenario: Switching Between Modules
- **Given** the user is viewing `/migration`,
- **When** they click "Chats & Mensajes" in the sidebar,
- **Then** the URL updates to `/chats` without reloading the page,
- **And** the `ChatsView` component renders.
