# Change Proposal: accessible-shadcn-ui

## Why
The initial dashboard implementation used native HTML elements and manual Tailwind containers for dialogs, channel selectors, and progress bars. While visually styled, these manual components lack full WAI-ARIA accessibility compliance:
1. Modal dialogs do not enforce focus trapping, Esc key dismissal, or screen reader announcements (`role="dialog"`, `aria-modal="true"`).
2. Channel selectors rely on basic browser `<select>` controls without rich keyboard navigation or accessible ARIA combobox attributes.
3. The progress bar and streaming logs lack `aria-live="polite"` regions and `role="progressbar"` attributes, preventing assistive technologies from tracking migration progress.

## What
Integrate Radix UI primitives and shadcn/ui component patterns into the frontend:
1. **Dependencies**: Install `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-progress`, `@radix-ui/react-slot`, and `class-variance-authority`.
2. **Shared UI Primitives**: Create reusable, fully accessible primitives in `frontend/src/shared/components/ui/`:
   - `dialog.tsx` (accessible modal with focus trap, backdrop, description, title)
   - `select.tsx` (accessible custom dropdown with keyboard roving tabindex)
   - `progress.tsx` (accessible progress bar with semantic aria attributes)
   - `button.tsx` (accessible button with Slot composition)
3. **Feature Refactoring**:
   - Refactor `ConfirmModal.tsx` to use `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription`.
   - Refactor `ChannelSelector.tsx` to use Radix `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`.
   - Refactor `ProgressBar.tsx` to use Radix `Progress` with live status.
   - Enhance `TerminalLog.tsx` with `aria-live="polite"`.
4. **Constraint Preservation**: Maintain the strict constraint of at most 2 `useState` hooks in `MigrationView.tsx`.

## Capabilities
- `capability:accessible-dialog`: Focus-trapped modal dialog conforming to WAI-ARIA dialog patterns.
- `capability:accessible-channel-select`: Keyboard-navigable custom select dropdown with screen reader announcements.
- `capability:accessible-progress-live-region`: Semantic progress indicator and polite live region updates for real-time events.

## Impact & Risks
- **Bundle Size**: Negligible increase (~15-20 KB gzipped) from Radix headless primitives.
- **State Constraint**: Unchanged; state remains in Zustand `useMigrationStore` and `MigrationView` keeps only 2 `useState` hooks.
