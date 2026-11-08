# Feature: Content Reservoir & Recurring Drip Campaign Engine

Enable users to stage media from source channels into an intelligent persistent Content Reservoir that drips posts into target channels on a configured cadence (e.g., 1 video every 2 hours, daily active hours 09:00-22:00, jitter to avoid bot detection), with real-time queue inspection, manual early release, caption editing, and lifecycle controls.

Delivery strategy: single-pr

## Specs
- S1: Database Entity & Persistence:
  - Add domain entities `DripCampaign` and `ReservoirItem` in `backend/domain/entities/drip_campaign.py`.
  - Add tables `drip_campaigns` and `reservoir_items` in SQLite (`SQLiteJobRepository`) and Postgres (`PostgresJobRepository`).
  - Implement repository methods in `JobRepositoryPort`, `SQLiteJobRepository`, and `PostgresJobRepository`:
    - `create_drip_campaign(campaign: DripCampaign, items: list[ReservoirItem]) -> DripCampaign`
    - `get_drip_campaign(campaign_id: str) -> DripCampaign | None`
    - `list_drip_campaigns(status: str | None = None) -> list[DripCampaign]`
    - `update_drip_campaign(campaign: DripCampaign) -> bool`
    - `delete_drip_campaign(campaign_id: str) -> bool`
    - `list_reservoir_items(campaign_id: str, status: str | None = None, limit: int = 50, offset: int = 0) -> tuple[list[ReservoirItem], int]`
    - `get_reservoir_item(item_id: str) -> ReservoirItem | None`
    - `update_reservoir_item(item: ReservoirItem) -> bool`
    - `get_due_drip_items(now_iso: str) -> list[tuple[DripCampaign, ReservoirItem]]`
- S2: Reservoir & Drip Campaign Engine (`DripCampaignService`):
  - Ingestion: Extract media items, calculate staged timestamps with configurable interval, random jitter, and optional daily operating window (e.g., 09:00 - 22:00 UTC/local).
  - Background loop polling every 15-30s for due items in `ACTIVE` campaigns.
  - Release execution: Copies or streams media to target channel via `TelegramGatewayPort`, applying caption templates and AI transformations, handling flood waits and failover.
  - Lifecycle methods: `pause_campaign`, `resume_campaign`, `cancel_campaign`, `release_item_now`, `skip_item`, `update_item_caption`.
  - App lifespan integration in `main.py` and `dependencies.py`.
- S3: REST API Endpoints (`/api/reservoir`):
  - `POST /api/reservoir/campaigns`: Ingest media and create new campaign.
  - `GET /api/reservoir/campaigns`: List campaigns.
  - `GET /api/reservoir/campaigns/{id}`: Campaign details.
  - `POST /api/reservoir/campaigns/{id}/pause`: Pause campaign.
  - `POST /api/reservoir/campaigns/{id}/resume`: Resume campaign.
  - `DELETE /api/reservoir/campaigns/{id}`: Delete campaign.
  - `GET /api/reservoir/campaigns/{id}/items`: Paginated reservoir items.
  - `POST /api/reservoir/items/{item_id}/release-now`: Immediate dispatch.
  - `PATCH /api/reservoir/items/{item_id}`: Edit caption.
  - `POST /api/reservoir/items/{item_id}/skip`: Skip item.
- S4: Frontend Reservoir & Drip Console:
  - Client API in `dripApi.ts`.
  - Tab `"drip"` in `JobsView.tsx` with badge and icon.
  - Component `DripCampaignsCard.tsx` with KPI metrics, campaign cards, progress bar, countdown to next release, and queue table with actions.
  - "Nueva Campaña Drip" Modal for configuring source/target channels, interval, batch size, daily window, and AI caption rules.
  - Strict adherence to $\le 2$ `useState` hooks per component.
- S5: Testing & Verification:
  - Automated unit tests in `backend/tests/test_drip_campaign.py`.
  - Vitest test in `frontend/src/features/jobs/presentation/__tests__/DripCampaignsCard.test.tsx`.
  - Container build & deployment verification.

## Tasks
- [x] T1 (S1): Define `DripCampaign` and `ReservoirItem` entities and SQLite/Postgres schemas [inline]
- [x] T2 (S1): Implement repository methods in `JobRepositoryPort`, `SQLiteJobRepository`, and `PostgresJobRepository` [inline]
- [x] T3 (S2): Implement `DripCampaignService` with schedule calculation, daily windows, and worker loop [inline]
- [x] T4 (S3): Implement REST router in `backend/presentation/api/routers/reservoir.py` and mount in `main.py` [inline]
- [x] T5 (S5): Write backend automated unit tests in `backend/tests/test_drip_campaign.py` and verify with pytest [inline]
- [x] T6 (S4): Implement `dripApi.ts`, `DripCampaignsCard.tsx`, and integrate into `JobsView.tsx` within 2-hook budget [inline]
- [x] T7 (S5): Write frontend tests, build production bundle, and deploy to Docker containers [inline]
- [x] T8 (S5): Git commit and push with conventional commit message [inline]

## Log
- L1: Initialized ODD task for Content Reservoir & Recurring Drip Campaign Engine.
- L2: Defined domain entities `DripCampaign` and `ReservoirItem` with migration tables in SQLite and Postgres.
- L3: Built `DripCampaignService` with interval calculation, daily window clamping, jitter, early manual release, and background worker loop.
- L4: Mounted `/api/reservoir` REST router in FastAPI app with lifecycle hooks in `main.py`.
- L5: Verified backend unit & integration tests (6/6 in `test_drip_campaign.py`).
- L6: Implemented `dripApi.ts` and `DripCampaignsCard.tsx` under the strict 2-hook budget, integrated tab in `JobsView.tsx`.
- L7: Verified frontend tests (66/66 passed across 18 suites), built production bundle, and deployed to containers.
