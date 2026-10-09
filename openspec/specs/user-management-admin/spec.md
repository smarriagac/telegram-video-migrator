# Specification: user-management-admin

## Requirement: Admin Listing and Creation of Users
The backend MUST provide endpoints accessible only by `ADMIN` users to query all platform accounts and provision new users with specific roles.

### Scenario: Admin Lists Users
- **Given** an authenticated user with role `ADMIN`,
- **When** requesting `GET /api/auth/users`,
- **Then** the backend returns an array of user objects including `id`, `email`, `role`, and `is_active`.

### Scenario: Non-Admin Forbidden
- **Given** an authenticated user with role `OPERATOR`,
- **When** requesting `GET /api/auth/users`,
- **Then** the backend returns HTTP 403 Forbidden.
