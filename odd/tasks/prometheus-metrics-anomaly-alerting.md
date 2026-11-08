# ODD Task: Prometheus / Grafana Observability Metrics & Anomaly Alerting Engine

## Status: COMPLETED
**Assigned**: Senior Architect
**Scope**: Prometheus/OpenMetrics text exporter (`/metrics`), JSON observability API, multi-rule anomaly detection engine hooked to `AlertingService`, and frontend Enterprise Observability dashboard card ($\le 2$ `useState`).

---

## 1. Problem & Context
In production deployments, site reliability engineers (SREs) and system administrators require standard Prometheus/Grafana scrape endpoints to monitor:
1. Migration jobs and queue item health (pending, in progress, failed, completed).
2. MTProto session pool status (active accounts vs accounts in FloodWait cooldown).
3. Bandwidth consumption and Rate Governor throttling stats.
4. Cross-channel deduplication savings (fingerprints indexed, megabytes saved).
5. Proactive anomaly alerting (detecting high failure spikes or pool exhaustion before jobs halt).

---

## 2. Technical Architecture & Design

### 2.1 Observability Service (`backend/application/services/observability_service.py`)
- Gathers data from `JobRepositoryPort`, `TelegramClientPool`, `RateGovernorService`, and system telemetry.
- Implements:
  - `generate_prometheus_metrics() -> str`: Formats gauges and counters into Prometheus/OpenMetrics text exposition format (`# HELP`, `# TYPE`, metric values and labels).
  - `get_metrics_summary() -> dict`: Formats data as structured JSON.
  - `evaluate_system_anomalies() -> list[dict]`: Evaluates failure rates, FloodWait events, and account availability, triggering `AlertingService.send_alert` when thresholds are breached.

### 2.2 Presentation Endpoints (`backend/presentation/api/routers/metrics.py` and `backend/main.py`)
- `GET /metrics`: Returns `text/plain` OpenMetrics output for Prometheus scrapers.
- `GET /api/system/metrics`: Returns JSON telemetry for frontend dashboards.
- `POST /api/system/metrics/anomalies/evaluate`: Triggers proactive anomaly scan and sends alerts if needed.

### 2.3 Frontend Presentation (`frontend/src/features/settings/presentation/components/ObservabilityCard.tsx`)
- Displays:
  - Metric counters (Total jobs, active queues, saved bandwidth, account pool health).
  - Prometheus scrape endpoint URL with one-click copy.
  - Prometheus config scrape snippet modal / preview.
  - Manual anomaly evaluation trigger button.
- Strict constraint: Maximum 2 `useState` hooks.

---

## 3. Verification & Results
1. Backend unit tests in [`test_observability_metrics.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/tests/test_observability_metrics.py): 5 passed.
2. Full backend test suite: 211 passed.
3. Frontend unit tests in [`ObservabilityCard.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/__tests__/ObservabilityCard.test.tsx): 4 passed.
4. Full frontend test suite: 62 passed.
5. Production bundle `npm run build`: Succeeded.
6. Live container verification: Tested `GET /metrics`, `GET /api/system/metrics`, and `POST /api/system/metrics/anomalies/evaluate`. All return HTTP 200.
