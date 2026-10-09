# Specification: accessible-dialog

## Requirement: WAI-ARIA Compliant Modal Dialog
The confirmation dialog MUST wrap Radix Dialog primitives to enforce focus containment, escape key handling, and semantic dialog roles.

### Scenario: Focus Trapping and Keyboard Accessibility
- **Given** the confirmation modal is open,
- **When** the user presses `Tab` or `Shift+Tab`,
- **Then** focus cycles strictly between the interactive elements inside the dialog (Cancel and Confirm buttons).

### Scenario: Escape Key Dismissal
- **Given** the confirmation modal is open,
- **When** the user presses the `Escape` key,
- **Then** the dialog closes and focus returns to the initiating trigger button.
