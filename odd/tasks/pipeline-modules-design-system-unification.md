# Feature: Pipeline Modules Design System Unification
Harmonize the Pipeline Modules view (`PipelineModulesView.tsx`) with the dark cyber design system and canonical shadcn/ui tokens, eliminating hardcoded zinc/gray shades.
Delivery strategy: single-pr

## Specs
- S1: Tab Switcher Header Palette Harmonization:
  - Replace raw `bg-zinc-900 border-zinc-800` container with `bg-secondary/60 border border-border`.
  - Active tab styling: `bg-primary/10 text-primary border border-primary/20 shadow-sm font-semibold`.
  - Inactive tab styling: `text-muted-foreground hover:text-foreground hover:bg-secondary/40`.
- S2: Drip Feed Pacing Cards Harmonization:
  - Pacing option cards: replace `bg-zinc-900/40 border-zinc-800 text-zinc-400` with `bg-card border-border hover:bg-secondary/40 text-muted-foreground`.
  - Active selection: `bg-cyan-500/10 border-cyan-500/40 text-cyan-300 shadow-sm`.
  - Info status banner: `bg-secondary/40 border-border text-muted-foreground`.
- S3: Quality Filter Presets & Canonical `<Input>` Components:
  - Replace raw HTML inputs with canonical `<Input>` from `@/shared/components/ui/input`.
  - Replace hardcoded `zinc-950` and `zinc-800` cards with `bg-card border border-border`.
  - Presets and content type toggles aligned to semantic tokens.
- S4: Frontend Build & Container Deployment:
  - Run `npm run build` with zero TypeScript or bundling errors.
  - Deploy dist artifacts to `telegram_migrator_frontend:/usr/share/nginx/html/`.

## Tasks
- [x] T1 (S1): Create ODD task specification [inline]
- [x] T2 (S1): Update tab switcher styling in `PipelineModulesView.tsx` [inline]
- [x] T3 (S2): Update Drip Feed pacing cards and status banner to semantic tokens [inline]
- [x] T4 (S3): Import `<Input>` and replace raw inputs and zinc containers in Quality Filter module [inline]
- [x] T5 (S4): Compile frontend bundle and deploy to Nginx container [inline]
- [x] T6 (S4): Conventional commit and push to Git [inline]

## Log
- L1: User pointed out that the Pipeline tab bar (`Captions`, `Drip Feed`, `Dedup`, `Calidad`) does not adhere to the app's color palette (hardcoded zinc-900/zinc-800).
- L2: Audited `PipelineModulesView.tsx` and found raw zinc classes across tabs, drip feed cards, and quality filter inputs.
- L3: Following mandatory ODD discipline, created specification in `odd/tasks/pipeline-modules-design-system-unification.md`.
- L4: Replaced hardcoded zinc styling with semantic tokens (`bg-secondary/60`, `border-border`, `bg-primary/10`, `text-primary`, `bg-card`).
- L5: Integrated canonical `<Input>` component for all text and numerical inputs.
- L6: Rebuilt frontend and deployed to Docker container `telegram_migrator_frontend`. All tasks verified.
