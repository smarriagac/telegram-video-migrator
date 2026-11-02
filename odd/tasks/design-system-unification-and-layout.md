# Feature: Design System Unification, Responsive Drawer & Symmetrical Analytics
Unify color palette across all 24 views and modals to Telegram Cyan/Slate semantic tokens, relocate drawer toggle next to logo, add user profile menu with logout, fix mobile tables, and make analytics volume & media distribution charts horizontally symmetrical.
Delivery strategy: single-pr

## Specs
- S1: Replace hardcoded `#14161F`, `bg-zinc-950`, `text-cyan-400`, `bg-emerald-500` with semantic design tokens (`bg-card`, `bg-secondary`, `bg-primary`, `border-border`, `text-foreground`, `text-muted-foreground`) across all views and modals.
- S2: Move drawer toggle button to top navigation bar beside "Telegram Hub" brand header on mobile/tablet viewports.
- S3: Add user avatar dropdown in top navbar displaying current user email, role badge, and functional "Cerrar Sesión" action.
- S4: Fix mobile table overflow on `/chats` and `/cuentas` views with horizontal touch scroll wrapper and auto-sizing columns.
- S5: Align "Volumen Diario de Migración" and "Distribución de Medios" charts into horizontal 3-column rows `[Label] [Fluid Bar] [Tabular Metrics]`.

## Tasks
- [x] T1 (S1): Migrate hardcoded hex and Tailwind dark values in all feature views to semantic tokens [inline]
- [x] T2 (S1): Refactor `switch.tsx` to use `data-[state=checked]:bg-primary` instead of hardcoded emerald [inline]
- [x] T3 (S2): Reposition drawer toggle button next to logo in `AppLayout.tsx` [inline]
- [x] T4 (S3): Implement user avatar menu with logout in `AppLayout.tsx` [inline]
- [x] T5 (S4): Add responsive scroll containers to data tables on mobile screens [inline]
- [x] T6 (S5): Refactor `AnalyticsView.tsx` daily volume to fluid horizontal bars with fixed-width labels and metric badges [inline]
- [x] T7 (S5): Refactor `AnalyticsView.tsx` media distribution to symmetrical horizontal bars matching volume rows [inline]
- [x] T8 (S1-S5): Compile frontend with `tsc -b && vite build` and deploy bundle into Nginx container [inline]

## Log
- L1: Identified duplicate color schemes across modules and hardcoded emerald/cyan conflicting accents.
- L2: Refactored 24 frontend files to unified semantic tokens (`bg-card`, `bg-secondary`, `text-primary`, etc.).
- L3: Relocated mobile hamburger trigger next to brand title and added user dropdown menu.
- L4: Fixed responsive overflow on mobile viewports for data tables.
- L5: Fixed visual asymmetry on daily migration volume and media distribution horizontal bars in `AnalyticsView.tsx`.
- L6: Frontend built clean and live reloaded in Docker Nginx container at port 7900.
