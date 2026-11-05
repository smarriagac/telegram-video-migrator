# Feature: Guided Sequential Flow & Progressive Disclosure for Video Cloning

Refactor `MigrationControlPanel.tsx` and `MigrationView.tsx` to eliminate cognitive overload by implementing a clear 1-2-3 guided sequential flow (Source -> Content -> Target), dynamic transparent CTA buttons, collapsible advanced pipeline settings, and guided empty states.

Delivery strategy: single-pr

## Specs
- S1: Sequential 1-2-3 Guided Hierarchy in `MigrationControlPanel.tsx`:
  - Step 1: Source Channel Selector (`1. Origen - De dónde clonar`) with audit history badge.
  - Step 2: Target Channel Selector (`2. Destino - A dónde enviar`) with local PC upload option.
  - Step 3: Collapsible Advanced Pipeline Drawer (`Ajustes Avanzados del Pipeline (Opcional)`):
    - Auto-Sync MTProto Push toggle & delta audit.
    - Caption rules quick configuration button.
    - Anti-flood pacing / drip schedule selector.
- S2: Dynamic & Transparent CTA Button:
  - Dynamically updates label based on user selection:
    - If N messages selected: `Clonar ${count} videos seleccionados →`.
    - If 0 messages selected: `Clonar canal completo (${total} videos) →`.
    - Disables with informative validation tooltips if origin/destination unselected or matching.
- S3: Guided Empty State in `MessageSelector.tsx`:
  - When no source channel is selected, display an inviting step-by-step onboarding card: `Paso 1: Seleccioná un canal de origen en el panel izquierdo para explorar sus videos`.
- S4: Architectural Constraints:
  - Consolidate panel UI state into a single `useState` hook (well within the <=2 hook budget).
  - Use canonical shadcn/ui components and dark cyber tokens.
  - Verify complete TypeScript build (`npm run build`) and backend tests (`pytest`).

## Tasks
- [x] T1 (S1, S2): Refactor `MigrationControlPanel.tsx` with guided steps, collapsible drawer, and dynamic button [inline]
- [x] T2 (S3): Enhance `MessageSelector.tsx` empty state with guided onboarding card [inline]
- [x] T3 (S4): Compile frontend bundle and deploy to Docker container [inline]
- [x] T4 (S4): Run full backend test suite (`pytest`) [inline]
- [x] T5 (S4): Git commit and push with conventional commit message [inline]

## Log
- L1: User inquired about improving the intuitiveness of the Video Cloner module.
- L2: Identified cognitive overload and violated Progressive Disclosure principles in `MigrationControlPanel.tsx`. Proposed and approved a 1-2-3 sequential flow with dynamic CTA button and collapsible advanced drawer.
- L3: Reorganized `MigrationControlPanel.tsx` into Step 1 (Origen) and Step 2 (Destino), collapsed advanced pipeline settings into an optional drawer, and converted CTA button into an informative guided action indicator.
- L4: Added guided empty state in `MessageSelector.tsx` directing the user to select a source channel first.
- L5: Verified all 113 automated tests pass and frontend compiled with 0 errors.
