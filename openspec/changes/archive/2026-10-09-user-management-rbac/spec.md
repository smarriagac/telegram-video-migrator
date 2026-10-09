# Specifications: user-management-rbac

## Capability: user-management-admin

### Requirement: Admin Listing and Creation of Users
The backend MUST provide endpoints accessible only by `ADMIN` users to query all platform accounts and provision new users with specific roles.

#### Scenario: Admin Lists Users
- **Given** an authenticated user with role `ADMIN`,
- **When** requesting `GET /api/auth/users`,
- **Then** the backend returns an array of user objects including `id`, `email`, `role`, and `is_active`.

#### Scenario: Non-Admin Forbidden
- **Given** an authenticated user with role `OPERATOR`,
- **When** requesting `GET /api/auth/users`,
- **Then** the backend returns HTTP 403 Forbidden.

---

## Capability: role-assignment-lifecycle

### Requirement: Update Role and Active Status
Administrators MUST be able to update another user's execution role or active flag without altering passwords.

#### Scenario: Promoting an Operator to Admin
- **Given** an existing active user with role `OPERATOR`,
- **When** an administrator sends `PATCH /api/auth/users/{user_id}` with `{"role": "ADMIN"}`,
- **Then** the user's role is updated in PostgreSQL,
- **And** the updated user representation is returned.

#### Scenario: Preventing Self-Deactivation
- **Given** an administrator authenticated with user ID `1`,
- **When** they attempt `PATCH /api/auth/users/1` with `{"is_active": false}`,
- **Then** the backend rejects the request with HTTP 400 Bad Request to prevent lockout.
