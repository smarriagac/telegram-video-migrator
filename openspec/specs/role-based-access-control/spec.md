# Specification: role-based-access-control

## Requirement: RBAC Route and Endpoint Protection
Endpoints and client views MUST enforce access restrictions based on the user's assigned role (`ADMIN`, `OPERATOR`, `VIEWER`).

### Scenario: Admin Only Operation
- **Given** an authenticated user with role `OPERATOR`,
- **When** they attempt to modify Telegram API credentials via `POST /api/settings/credentials`,
- **Then** the backend rejects the request with HTTP 403 Forbidden.

### Scenario: Module Visibility
- **Given** an authenticated user with role `VIEWER`,
- **When** viewing the sidebar,
- **Then** administrative configuration actions are restricted.
