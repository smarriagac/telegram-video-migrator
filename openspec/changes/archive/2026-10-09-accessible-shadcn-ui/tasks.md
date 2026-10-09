# Tasks: accessible-shadcn-ui

## Phase 1: Dependencies & Shared Primitives
- [x] 1.1 Install Radix UI packages and `class-variance-authority` in `frontend/`.
- [x] 1.2 Implement accessible `Button` primitive in `frontend/src/shared/components/ui/button.tsx`.
- [x] 1.3 Implement accessible `Dialog` primitives in `frontend/src/shared/components/ui/dialog.tsx`.
- [x] 1.4 Implement accessible `Select` primitives in `frontend/src/shared/components/ui/select.tsx`.
- [x] 1.5 Implement accessible `Progress` primitive in `frontend/src/shared/components/ui/progress.tsx`.

## Phase 2: Feature Refactoring & Accessibility Enhancements
- [x] 2.1 Refactor `ConfirmModal.tsx` using Radix `Dialog` primitives.
- [x] 2.2 Refactor `ChannelSelector.tsx` using Radix `Select` primitives.
- [x] 2.3 Refactor `ProgressBar.tsx` using Radix `Progress` with semantic ARIA roles.
- [x] 2.4 Enhance `TerminalLog.tsx` with `aria-live="polite"` live region.
- [x] 2.5 Verify `MigrationView.tsx` adheres strictly to <= 2 `useState` hooks.

## Phase 3: Verification & Docker Deployment
- [x] 3.1 Verify frontend production build with zero type errors (`npm run build`).
- [x] 3.2 Rebuild and restart Docker frontend container.
- [x] 3.3 Verify live accessible components at `http://localhost:7900`.
