# Feature: Comprehensive Dashboard Responsive Audit & Mobile-First Optimization

Delivery strategy: single-pr

## Summary
Systematically audit and optimize every operational module of the Telegram Video Migrator web dashboard for seamless responsiveness on mobile (360px–430px), tablet, and desktop viewports:
1. `features/migration` (`MigrationView`): Step-by-step cloner wizard, channel select dropdowns, message grid/cards, video preview player, and floating execution footer.
2. `features/channels` (`ChannelManagementView`): Channel KPI cards, filter pills, data table to card fallback on mobile, and add/edit channel modals.
3. `features/jobs` (`JobsView`): Metrics bar, queue table with mobile card layout, action buttons, and dead-letter queue sheet.
4. `features/sync` (`LiveSyncHubView`): Active sync pairs, real-time status badges, throughput cards, and modal sheets.
5. `features/migration` (`PipelineModulesView`): Caption rules, rate governor controls, watermark settings, and simulation playground.
6. `features/analytics`, `features/billing`, `features/settings`, `features/audit`: Grid card responsiveness, responsive tables, and system doctor diagnostic panels.

## Specs
- S1: Migration Workflow Responsiveness (`MigrationView`):
  - Wizard stepper adapts from horizontal pills to responsive numbered badges.
  - Channel selectors and message selection gallery stack cleanly on small viewports without horizontal clipping.
  - Floating action footer adapts to bottom navigation offset without occluding content.
- S2: Channels & Jobs Tables & Cards (`ChannelManagementView`, `JobsView`):
  - Table components wrap with responsive horizontal scrollbars and mobile card alternatives for dense rows.
  - Quick action buttons (pause, resume, retry, cancel, logs) use compact icon + accessible tooltip buttons on mobile.
- S3: Sync & Pipeline Modules (`LiveSyncHubView`, `PipelineModulesView`):
  - Sync pair cards stack source -> destination indicators vertically on narrow screens.
  - Rule sliders, toggles, and regex input cards adapt without breaking container boundaries.
- S4: Settings, Audit & Analytics:
  - System doctor check indicators and credential forms scale down to single-column on mobile.
  - Audit log table provides expandable details drawer/modal on mobile viewports.
- S5: Modals, Dialogs & Touch Ergonomics:
  - All `DialogContent` components enforce mobile viewport bounds (`max-w-[calc(100vw-2rem)]`, `max-h-[88dvh]`, `p-3.5 sm:p-6`).
  - Zero horizontal overflow (`overflow-x-hidden` on main layouts).
- S6: Verification & Quality:
  - Zero TypeScript compile errors (`npm run build`).
  - 100% pass on Vitest test suite (`npm test`).
  - Live deployment in Docker container tested.

## Tasks
- [x] T1 (S1): Audit & optimize `MigrationView.tsx` (channel selection, message cards, video player, cloner footer) [inline]
- [x] T2 (S2): Audit & optimize `ChannelManagementView.tsx` (KPIs, filter toolbar, responsive table/cards, modals) [inline]
- [x] T3 (S2): Audit & optimize `JobsView.tsx` (queue metrics, job list cards/table, log viewer) [inline]
- [x] T4 (S3): Audit & optimize `LiveSyncHubView.tsx` & `PipelineModulesView.tsx` (sync pairs, caption editor, pacing) [inline]
- [x] T5 (S4): Audit & optimize `SettingsView.tsx`, `AnalyticsView.tsx`, `BillingPlansView.tsx`, `AuditView.tsx` [inline]
- [x] T6 (S5): Audit modal dialogs across all modules for safe-area insets and mobile touch sizing [inline]
- [x] T7 (S6): Verify with `npm test` and `npm run build`, and deploy hotfix to frontend container [inline]

## Log
- L1: Initialized comprehensive responsive audit task for all dashboard modules.
- L2: Refactored `MigrationView.tsx` and `MessageSelector.tsx`: responsive step track with mobile labels, stacked action footers, and edge padding adjustments.
- L3: Optimized `ChannelManagementView.tsx`: compact ViewHeader action buttons (`hidden sm:inline`), responsive filter pills with mobile short labels, and dialog viewport bounds.
- L4: Hardened `JobsView.tsx`: scrollable tab navigation with mobile labels (`MTProto`, `FFmpeg`, `DLQ`, `Drip`), compact status buttons, and constrained `JobQueueModal.tsx` & `DeadLetterQueueCard.tsx`.
- L5: Streamlined `LiveSyncHubView.tsx` and `PipelineModulesView.tsx`: responsive switcher tabs, improved ViewHeader toolbar container flexibility, and bounds for sync binding modals.
- L6: Audited `SettingsView.tsx`, `AnalyticsView.tsx`, `BillingPlansView.tsx`, and `AuditView.tsx`: mobile pill wrappers, responsive action toolbars, and 1-column mobile grids.
- L7: Enforced `max-w-[calc(100vw-2rem)]` and `max-h-[88dvh]` across all 20+ DialogContent instances in the application.
- L8: Passed full Vitest test suite (20 test files / 73 tests) and production Vite TypeScript build (0 errors). Deployed build into `telegram_migrator_frontend` container.
- L9: Fixed close-button collision in `BroadcastMessageModal.tsx` (`pr-11 sm:pr-12` margin protection), removed `max-w-[170px]` artificial truncation on chat message previews in `ChatsView.tsx`, eliminated horizontal scrollbars (`overflow-x-hidden`) inside nested modal forms, and added compact responsive buttons for mobile toolbars.
