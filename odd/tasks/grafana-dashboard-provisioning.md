# ODD Task: Grafana Dashboard Provisioning & One-Click Exporter

## Status: COMPLETED
**Assigned**: Senior Architect
**Scope**: Pre-configured Grafana Dashboard JSON with MTProto pool, job queues, hot-failover telemetry, rate limiting and deduplication panels; REST endpoint for dashboard export; frontend one-click download/copy integration in `ObservabilityCard` ($\le 2$ `useState`).

---

## 1. Problem & Context
When operating enterprise monitoring with Prometheus, administrators need a turnkey Grafana dashboard with calibrated thresholds, units (bytes, seconds, counters), color schemes, and query definitions out of the box, without having to build panels manually from scratch.

---

## 2. Technical Architecture & Design

### 2.1 Grafana Dashboard Model & Asset
- Location: `backend/resources/grafana_dashboard.json` and served via `backend/application/services/observability_service.py`.
- Includes Panels:
  - MTProto Session Health: Online vs Cooldown.
  - Job Pipeline Throughput: Processed videos rate, job distribution by status.
  - Hot-Failover Counter: Live FloodWait rotations.
  - Deduplication Engine: Bandwidth saved in MB/GB and total fingerprints indexed.
  - Rate Governor: Bandwidth throttle limit.
  - System Resources: RSS memory and process uptime.

### 2.2 REST API Endpoint
- In `backend/presentation/api/routers/metrics.py`:
  - `GET /api/system/metrics/grafana-dashboard`: Returns the raw JSON dashboard with attachment headers for one-click browser download.

### 2.3 Frontend Integration
- In `frontend/src/features/settings/presentation/components/ObservabilityCard.tsx`:
  - Action buttons: "Descargar Dashboard Grafana" & "Copiar JSON Grafana".
  - Strict constraint: Maximum 2 `useState` hooks.

---

## 3. Verification & Results
1. Backend unit tests in [`test_observability_metrics.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/tests/test_observability_metrics.py): 6 passed.
2. Frontend unit tests in [`ObservabilityCard.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/__tests__/ObservabilityCard.test.tsx): 5 passed.
3. Production bundle `npm run build`: Succeeded.
4. Live verification: `GET /api/system/metrics/grafana-dashboard` verified in container with HTTP 200.
