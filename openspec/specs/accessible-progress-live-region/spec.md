# Specification: accessible-progress-live-region

## Requirement: Semantic Progress and Live Region Announcements
The progress bar and event stream MUST announce real-time updates via assistive technology standards.

### Scenario: Progress Bar Semantics
- **Given** an active migration job,
- **When** the progress updates to `X%`,
- **Then** the progress component exposes `role="progressbar"`, `aria-valuenow="X"`, `aria-valuemin="0"`, and `aria-valuemax="100"`.

### Scenario: Live Terminal Announcements
- **Given** the live log terminal,
- **When** a new migration event arrives,
- **Then** it is rendered in an element with `aria-live="polite"` and `aria-atomic="false"`.
