# AGENTS.md — Telegram Video Migrator

## Core Guidelines

- **UI Components (MANDATORY)**: Always use shadcn/ui components from `@/shared/components/ui/` (`Button`, `Badge`, `Select`, `Switch`, `Input`, `Card`, `Dialog`, `Table`, etc.). Never write raw HTML `<button>`, `<select>`, `<input>`, or custom switch toggles.
- **Git Commits**: Conventional commits only (`feat:`, `fix:`, `refactor:`, etc.). Never add "Co-Authored-By" or AI attribution.
- **State Management**: Maximum 2 `useState` hooks per view component; use Zustand for global domain workflows.
