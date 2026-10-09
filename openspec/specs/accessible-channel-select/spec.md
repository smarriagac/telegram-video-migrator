# Specification: accessible-channel-select

## Requirement: Accessible Select Dropdown
The channel selector controls MUST wrap Radix Select primitives with full keyboard navigation and accessible roles.

### Scenario: Arrow Key Selection and Screen Reader Announcements
- **Given** the channel select dropdown is opened,
- **When** the user navigates using `ArrowUp` or `ArrowDown` keys,
- **Then** the highlighted item updates with `aria-selected` attributes and screen reader announcements.
