# AGENTS.md — Telegram Video Migrator

## Core Guidelines

- **ODD (Organic Driven Development - MANDATORY)**: Every task, bug fix, or feature must be documented in `odd/tasks/<task-slug>.md` with Specs (S1..Sn), atomic Tasks (T1..Tn), and Bitácora/Log (L1..Ln).
- **TDD (Test-Driven Development - MANDATORY)**: Every bug fix or new feature must have an automated regression test in `backend/tests/` (for backend/queue logic) or component tests in frontend. Run full test suite in Docker (`docker exec telegram_migrator_backend pytest backend/tests/`) and verify 100% pass before considering work done.
- **UI Components (MANDATORY)**: Always use shadcn/ui components from `@/shared/components/ui/` (`Button`, `Badge`, `Select`, `Switch`, `Input`, `Card`, `Dialog`, `Table`, etc.). Never write raw HTML `<button>`, `<select>`, `<input>`, or custom switch toggles.
- **Zero Browser Alerts/Confirms**: Strictly prohibited to use `window.confirm` or `window.alert`. Always use canonical `@/shared/components/ui/confirm-dialog.tsx`.
- **Git Commits**: Conventional commits only (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`). Never add "Co-Authored-By" or AI attribution.
- **State Management**: Maximum 2 `useState` hooks per view component; use Zustand for global domain workflows.
