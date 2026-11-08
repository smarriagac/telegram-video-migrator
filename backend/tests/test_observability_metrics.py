from __future__ import annotations

import time
import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from backend.domain.entities.migration_job import MigrationJob, JobStatus
from backend.application.services.observability_service import ObservabilityService
from backend.main import app


@pytest.fixture
def mock_job_repo():
    repo = MagicMock()
    sample_jobs = [
        MigrationJob(job_id="j1", source_id=1, target_id=2, status=JobStatus.COMPLETED, failover_count=1, processed_videos=10, total_videos=10),
        MigrationJob(job_id="j2", source_id=1, target_id=2, status=JobStatus.RUNNING, failover_count=2, processed_videos=3, total_videos=20),
        MigrationJob(job_id="j3", source_id=1, target_id=2, status=JobStatus.FAILED, failover_count=0, processed_videos=0, total_videos=5),
    ]
    repo.list_jobs = AsyncMock(return_value=(sample_jobs, len(sample_jobs)))
    repo.get_deduplication_stats = AsyncMock(return_value={
        "total_fingerprints": 42,
        "total_deduplicated_items": 15,
        "estimated_saved_mb": 375.5,
    })
    return repo


@pytest.fixture
def mock_client_pool():
    pool = MagicMock()
    pool.clients = {1: MagicMock(), 2: MagicMock()}
    pool.flood_wait_cooldowns = {2: time.time() + 300}  # account 2 in cooldown
    return pool


@pytest.fixture
def mock_rate_governor():
    gov = MagicMock()
    gov.get_summary = MagicMock(return_value={
        "mode": "HIGH_SPEED",
        "limit_bytes_per_sec": 5242880,
    })
    return gov


@pytest.fixture
def mock_alerting_service():
    alerting = MagicMock()
    alerting.send_alert = AsyncMock(return_value=True)
    return alerting


@pytest.mark.asyncio
async def test_collect_metrics(mock_job_repo, mock_client_pool, mock_rate_governor):
    service = ObservabilityService(
        job_repository=mock_job_repo,
        client_pool=mock_client_pool,
        rate_governor=mock_rate_governor,
    )

    metrics = await service.collect_metrics()

    assert "uptime_seconds" in metrics
    assert metrics["memory_rss_bytes"] > 0

    jobs = metrics["jobs"]
    assert jobs["total"] == 3
    assert jobs["by_status"]["COMPLETED"] == 1
    assert jobs["by_status"]["RUNNING"] == 1
    assert jobs["by_status"]["FAILED"] == 1
    assert jobs["total_failovers"] == 3

    dedup = metrics["deduplication"]
    assert dedup["fingerprints_indexed"] == 42
    assert dedup["deduplicated_items"] == 15
    assert dedup["saved_bytes"] == int(375.5 * 1024 * 1024)

    pool = metrics["mtproto_pool"]
    assert pool["total_accounts"] == 2
    assert pool["online_accounts"] == 1
    assert pool["cooldown_accounts"] == 1

    rate = metrics["rate_governor"]
    assert rate["mode"] == "HIGH_SPEED"
    assert rate["limit_bytes_per_sec"] == 5242880


@pytest.mark.asyncio
async def test_format_prometheus(mock_job_repo, mock_client_pool, mock_rate_governor):
    service = ObservabilityService(
        job_repository=mock_job_repo,
        client_pool=mock_client_pool,
        rate_governor=mock_rate_governor,
    )

    metrics = await service.collect_metrics()
    prom_text = service.format_prometheus(metrics)

    assert "# HELP telegram_migrator_uptime_seconds" in prom_text
    assert "# TYPE telegram_migrator_uptime_seconds gauge" in prom_text
    assert 'telegram_migrator_jobs_total{status="COMPLETED"} 1' in prom_text
    assert 'telegram_migrator_jobs_total{status="RUNNING"} 1' in prom_text
    assert "telegram_migrator_failovers_total 3" in prom_text
    assert "telegram_migrator_deduplication_fingerprints_indexed 42" in prom_text
    assert 'telegram_migrator_telegram_accounts_total{status="online"} 1' in prom_text
    assert 'telegram_migrator_telegram_accounts_total{status="cooldown"} 1' in prom_text


@pytest.mark.asyncio
async def test_evaluate_anomalies_pool_exhausted(mock_job_repo, mock_alerting_service):
    exhausted_pool = MagicMock()
    exhausted_pool.clients = {1: MagicMock(), 2: MagicMock()}
    exhausted_pool.flood_wait_cooldowns = {1: time.time() + 300, 2: time.time() + 600}

    service = ObservabilityService(
        job_repository=mock_job_repo,
        client_pool=exhausted_pool,
        alerting_service=mock_alerting_service,
    )

    anomalies = await service.evaluate_anomalies(dispatch_alerts=True)
    assert len(anomalies) >= 1
    codes = [a["code"] for a in anomalies]
    assert "MTPROTO_POOL_EXHAUSTED" in codes

    mock_alerting_service.send_alert.assert_called()


@pytest.mark.asyncio
async def test_evaluate_anomalies_high_job_failure_rate(mock_alerting_service):
    repo = MagicMock()
    # 5 finished jobs, 4 failed -> 80% failure rate
    jobs = [
        MigrationJob(job_id=f"fail_{i}", source_id=1, target_id=2, status=JobStatus.FAILED)
        for i in range(4)
    ] + [
        MigrationJob(job_id="ok_1", source_id=1, target_id=2, status=JobStatus.COMPLETED)
    ]
    repo.list_jobs = AsyncMock(return_value=(jobs, len(jobs)))
    repo.get_deduplication_stats = AsyncMock(return_value={})

    service = ObservabilityService(
        job_repository=repo,
        alerting_service=mock_alerting_service,
    )

    anomalies = await service.evaluate_anomalies(dispatch_alerts=False)
    codes = [a["code"] for a in anomalies]
    assert "HIGH_JOB_FAILURE_RATE" in codes


@pytest.mark.asyncio
async def test_metrics_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Prometheus Scrape
        prom_res = await client.get("/metrics")
        assert prom_res.status_code == 200
        assert "telegram_migrator_uptime_seconds" in prom_res.text
        assert "telegram_migrator_jobs_total" in prom_res.text

        # 2. JSON Metrics
        json_res = await client.get("/api/system/metrics")
        assert json_res.status_code == 200
        data = json_res.json()
        assert "uptime_seconds" in data
        assert "jobs" in data
        assert "deduplication" in data
        assert "mtproto_pool" in data

        # 3. Anomaly Evaluation
        anom_res = await client.post("/api/system/metrics/anomalies/evaluate?dispatch=false")
        assert anom_res.status_code == 200
        anom_data = anom_res.json()
        assert "anomalies" in anom_data
        assert "count" in anom_data
