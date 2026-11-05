# Feature: Full Wizard Stepper Flow for Video Cloning

Transform the video cloning interface into a full-width multi-step wizard stepper with an interactive status bar (`1. Canales -> 2. Selección de Contenido -> 3. Resumen & Confirmar -> 4. Ejecución en Vivo`), providing single-task cognitive focus, full-screen media curation, and an executive review card before dispatch.

Delivery strategy: single-pr

## Specs
- S1: Top Step Status Bar (`WizardStatusBar`):
  - 3-step sequential progress bar with icons and status badges:
    - Step 1: `Canales (Origen y Destino)`
    - Step 2: `Selección de Contenido`
    - Step 3: `Resumen y Confirmación`
    - Step 4 (Dynamic): `En Ejecución` (active when a migration job is running or scheduled)
  - Clickable step navigation allowing jumping back to previous configured steps.
- S2: Step 1 - Focused Channel Configuration:
  - Clean centered or card layout for Source Channel and Target Channel with real avatars and history badges.
  - Collapsible optional pipeline drawer (Auto-sync, caption rules, drip pacing).
  - Navigation action: `Continuar a Selección de Contenido →` (enabled only with valid origin & destination).
- S3: Step 2 - Full-Width Media Gallery & Curation:
  - Expands `MessageSelector` across 100% of the canvas width (eliminating column cramping).
  - Preserves Cinema Fullscreen Lightbox, grid/list modes, filter tabs, and quick select toggles.
  - Navigation actions: `← Volver a Canales` and `Continuar al Resumen (${count || "Canal completo"}) →`.
- S4: Step 3 - Executive Review & Launch Card:
  - High-clarity summary card showing:
    - Source and Target channel identity cards with avatars and subscriber counts.
    - Media scope: explicit count of selected videos with thumbnail preview strip or "Canal completo".
    - Active pipeline rules summary (link stripping, mention replacement, signatures).
    - Execution mode: Immediate MTProto reference stream or Scheduled with DateTimePicker.
  - Launch button: `¡Iniciar Clonación MTProto! 🚀` and back button `← Modificar Contenido`.
- S5: Step 4 - Live Execution & Progress:
  - Displayed when `activeJob` is running, paused, or scheduled: real-time percentage, queue metrics (total, pending, completed, failed), live SSE terminal logs, and cancellation control.
- S6: Architectural Constraints:
  - Strictly maximum 2 `useState` hooks in `MigrationView.tsx`.
  - Zero browser alerts (`window.alert`).
  - Dark cyber design system with Telegram Sky Blue tokens.
  - 100% automated test coverage with all 113+ pytest tests passing and 0 TypeScript build errors.

## Tasks
- [x] T1 (S1): Create ODD task specification [inline]
- [x] T2 (S1, S2): Implement `WizardStatusBar` and Step 1 (Channels Config) in `MigrationView.tsx` within 2-hook budget [inline]
- [x] T3 (S3): Implement Step 2 (Full-width Media Gallery) with forward/backward step actions [inline]
- [x] T4 (S4): Implement Step 3 (Review & Launch Executive Card) with preview strip and scheduler [inline]
- [x] T5 (S5): Implement Step 4 (Live Execution Monitor) with queue metrics and SSE logs [inline]
- [x] T6 (S6): Compile frontend bundle and deploy to Docker container [inline]
- [x] T7 (S6): Run full pytest backend test suite [inline]
- [x] T8 (S6): Git commit and push with conventional commit message [inline]

## Log
- L1: User requested a true Wizard Stepper flow with a status bar of steps (1. Canales -> 2. Contenido -> 3. Resumen).
- L2: Initialized ODD task specification in `odd/tasks/migration-wizard-stepper-flow.md`.
- L3: Built `WizardStatusBar` at the top of `MigrationView.tsx` with progress indicator and clickable step navigation.
- L4: Implemented Step 1 (Focused Channels Configuration) with source/target selection and collapsible advanced pipeline settings.
- L5: Expanded Step 2 (`MessageSelector.tsx`) across 100% of the canvas width with bottom navigation actions.
- L6: Implemented Step 3 (Executive Review & Launch Card) with identity cards, media scope summary, pipeline rules, and optional DateTimePicker scheduler.
- L7: Integrated Step 4 (Live Execution Monitor) with real-time SSE progress, queue metrics, and cancellation controls.
- L8: Verified all 113 automated tests pass and frontend builds with 0 errors.
