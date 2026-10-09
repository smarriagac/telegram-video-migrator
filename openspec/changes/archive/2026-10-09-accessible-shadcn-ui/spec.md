# Specifications: accessible-shadcn-ui

## Capability: accessible-dialog

### Requirement: WAI-ARIA Compliant Modal Dialog
The confirmation dialog MUST wrap Radix Dialog primitives to enforce focus containment, escape key handling, and semantic dialog roles.

#### Scenario: Focus Trapping and Keyboard Accessibility
- **Given** the confirmation modal is open,
- **When** the user presses `Tab` or `Shift+Tab`,
- **Then** focus cycles strictly between the interactive elements inside the dialog (Cancel and Confirm buttons).

#### Scenario: Escape Key Dismissal
- **Given** the confirmation modal is open,
- **When** the user presses the `Escape` key,
- **Then** the dialog closes and focus returns to the initiating trigger button.

---

## Capability: accessible-channel-select

### Requirement: Accessible Select Dropdown
The channel selector controls MUST wrap Radix Select primitives with full keyboard navigation and accessible roles.

#### Scenario: Arrow Key Selection and Screen Reader Announcements
- **Given** the channel select dropdown is opened,
- **When** the user navigates using `ArrowUp` or `ArrowDown` keys,
- **Then** the highlighted item updates with `aria-selected` attributes and screen reader announcements.

---

## Capability: accessible-progress-live-region

### Requirement: Semantic Progress and Live Region Announcements
The progress bar and event stream MUST announce real-time updates via assistive technology standards.

#### Scenario: Progress Bar Semantics
- **Given** an active migration job,
- **When** the progress updates to `X%`,
- **Then** the progress component exposes `role="progressbar"`, `aria-valuenow="X"`, `aria-valuemin="0"`, and `aria-valuemax="100"`.

#### Scenario: Live Terminal Announcements
- **Given** the live log terminal,
- **When** a new migration event arrives,
- **Then** it is rendered in an element with `aria-live="polite"` and `aria-atomic="false"`.
