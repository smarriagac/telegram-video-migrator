# Specifications: multi-module-navigation

## Capability: client-side-routing

### Requirement: React Router v7 Root Navigation
The application MUST route users between modules using React Router v7 with browser history support.

#### Scenario: Default Route Redirection
- **Given** the user navigates to root `/`,
- **When** the router evaluates the path,
- **Then** it automatically redirects to `/migration`.

#### Scenario: Switching Between Modules
- **Given** the user is viewing `/migration`,
- **When** they click "Chats & Mensajes" in the sidebar,
- **Then** the URL updates to `/chats` without reloading the page,
- **And** the `ChatsView` component renders.

---

## Capability: app-shell-sidebar

### Requirement: Accessible Responsive Sidebar
The application layout MUST include a persistent sidebar with accessible ARIA navigation landmarks and active route styling.

#### Scenario: Active Route Highlighting
- **Given** the current URL is `/chats`,
- **When** the sidebar renders,
- **Then** the "Chats" navigation item displays active styling (`bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400`),
- **And** has `aria-current="page"`.
