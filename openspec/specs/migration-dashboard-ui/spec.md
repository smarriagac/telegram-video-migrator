# Specification: migration-dashboard-ui

## Requirement: React 19 Feature-First UI with Zustand Store
The frontend MUST render a responsive dark-mode view allowing the user to select channels, start/pause migration, and view real-time progress.

### Scenario: Strict useState Limit
- **Given** the `MigrationView` component,
- **When** state is initialized,
- **Then** `MigrationView` utilizes at most two `useState` hooks for local UI state (e.g., `isConfirmModalOpen`, `filterQuery`),
- **And** all domain, stream, channel, and job state is consumed from `useMigrationStore`.

### Scenario: Single-Click Migration Trigger
- **Given** valid source and destination channels selected in the UI,
- **When** the user clicks "Start Migration" and confirms,
- **Then** the UI dispatches a `POST /api/jobs` request,
- **And** connects to the SSE stream, updating the progress bar and terminal logs dynamically.
