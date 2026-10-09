# Specification: app-shell-sidebar

## Requirement: Accessible Responsive Sidebar
The application layout MUST include a persistent sidebar with accessible ARIA navigation landmarks and active route styling.

### Scenario: Active Route Highlighting
- **Given** the current URL is `/chats`,
- **When** the sidebar renders,
- **Then** the "Chats & Mensajes" navigation item displays active styling (`bg-cyan-500/10 text-cyan-400 border border-cyan-500/20`),
- **And** has `aria-current="page"`.
