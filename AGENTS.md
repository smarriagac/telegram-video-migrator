# AGENTS.md — Telegram Video Migrator

## Core Guidelines

- **UI Components**: Always use shadcn/ui components from `@/shared/components/ui/` (`Button`, `Badge`, `Select`, `Switch`, `Dialog`, etc.). No ad-hoc HTML buttons, selects, or toggles.
- **Git Commits**: Conventional commits only (`feat:`, `fix:`, `refactor:`, etc.). Never add "Co-Authored-By" or AI attribution.
- **State Management**: Maximum 2 `useState` hooks per view component; use Zustand for global domain workflows.
