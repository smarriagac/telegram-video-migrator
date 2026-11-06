# Feature: Professional Analytics & Operational Telemetry Center

Elevate the Analytics & Performance module (`AnalyticsView.tsx`) from a static partial dashboard into an authoritative, full-viewport Telemetry Center (Stripe/Cloudflare/Datadog grade) by adding a Live Transfer Audit Ledger across the lower 50% viewport, pipeline health telemetry (100% disk bypass, speed, floodwait prevention), and top channel traffic rankings.

Delivery strategy: single-pr

## Specs
- S1: Enriched Analytics Backend Schema & Queries:
  - Add `RecentTransferItem` and `TopChannelTrafficItem` schemas to `AnalyticsSummaryResponse` in `backend/presentation/api/routers/analytics.py`.
  - In `postgres_job_repository.py` and `sqlite_job_repository.py`:
    - Query `recent_transfers`: last 8 migration/sync jobs with source/target titles, IDs, processed count, status, and created timestamp.
    - Query `top_channels`: top 5 source channels by migrated items and saved volume in GB.
    - Compute `pipeline_health`: bypass percentage (`100.0%`), average speed (`~1.8s / item`), and push daemon status.
- S2: Frontend Telemetry Center (`AnalyticsView.tsx`):
  - Refined top KPI cards with typography and subtitle context.
  - Middle section:
    - Left: Daily Migration Volume Timeline with interactive percentage bars, GB scale, and items count.
    - Right: Media Type Distribution (Videos, Photos, Documents, Text) + Pipeline Health gauges.
  - Lower 50% section (Eliminating the dead black void):
    - **Live Transfer Audit Ledger (Tabla de Auditoría de Transferencias)**:
      - Symmetrical route display: Canal Origen → Canal Destino with real MTProto avatar thumbnails.
      - Columns: Ruta de Transferencia, Elementos, Ancho de Banda Ahorrado, Fecha / Hora, Estado del Job.
    - **Top Channel Leaderboard**:
      - Cards ranking top extracted channels with volume GB and total items.
- S3: Architectural Constraints:
  - Strictly maximum 2 `useState` hooks in `AnalyticsView.tsx` (0 or 1 used, state in Zustand store).
  - Zero browser alerts (`window.alert`).
  - Dark cyber design system with Telegram Sky Blue tokens.
  - 100% automated test compliance (all 113+ pytest tests passing, 0 TypeScript build errors).

## Tasks
- [x] T1 (S1): Update `AnalyticsSummaryResponse` schema in `analytics.py` and repository queries [inline]
- [x] T2 (S1): Add automated backend test in `backend/tests/test_analytics_and_sync_api.py` [inline]
- [x] T3 (S2): Update `useAnalyticsStore.ts` and domain types in frontend [inline]
- [x] T4 (S2): Redesign `AnalyticsView.tsx` with Live Transfer Ledger and Top Channels [inline]
- [x] T5 (S3): Compile frontend bundle and deploy to Docker container [inline]
- [x] T6 (S3): Run full backend test suite (`pytest`) [inline]
- [x] T7 (S3): Git commit and push with conventional commit message [inline]

## Log
- L1: User requested improving the metrics in the Analytics view, which suffered from a 50% empty lower viewport and basic progress bars.
- L2: Initialized ODD task specification in `odd/tasks/analytics-telemetry-dashboard-redesign.md`.
- L3: Added `recent_transfers`, `top_channels`, and `pipeline_health` to `AnalyticsSummaryResponse` and repository queries.
- L4: Verified automated backend test in `test_analytics_and_sync_api.py`.
- L5: Redesigned `AnalyticsView.tsx` incorporating the Live Transfer Audit Ledger across the lower 50% viewport, pipeline health telemetry gauges, and top channel traffic leaderboard.
- L6: All 113 automated backend tests passed cleanly and frontend compiled with 0 errors.
