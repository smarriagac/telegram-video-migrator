# Specification: channel-discovery

## Requirement: List Accessible Source and Destination Channels
The system MUST list channels where the authenticated user is an administrator or creator with message read and post permissions.

### Scenario: Retrieve Managed Channels
- **Given** an authenticated user session,
- **When** the frontend requests available channels via `GET /api/channels`,
- **Then** the API returns a list of channels with `id`, `title`, `username`, and `can_post_messages` flag.
