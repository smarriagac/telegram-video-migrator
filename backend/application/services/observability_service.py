from __future__ import annotations

import logging
import resource
import time
from typing import Any

from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.entities.migration_job import JobStatus

logger = logging.getLogger(__name__)

# Track process start time for uptime metrics
_PROCESS_START_TIME = time.time()


class ObservabilityService:
    """Collects enterprise metrics, formats OpenMetrics/Prometheus expositions, and detects anomalies."""

    def __init__(
        self,
        job_repository: JobRepositoryPort,
        client_pool: Any = None,
        rate_governor: Any = None,
        alerting_service: Any = None,
    ) -> None:
        self.job_repository = job_repository
        self.client_pool = client_pool
        self.rate_governor = rate_governor
        self.alerting_service = alerting_service

    async def collect_metrics(self) -> dict[str, Any]:
        """Collect and aggregate real-time system metrics across all subsystems."""
        # 1. Process & Runtime metrics
        uptime_seconds = round(time.time() - _PROCESS_START_TIME, 2)
        rss_bytes = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024

        # 2. Migration Jobs & Failovers
        jobs_res = await self.job_repository.list_jobs(limit=500, offset=0)
        jobs = jobs_res[0] if isinstance(jobs_res, tuple) else jobs_res

        jobs_by_status = {
            JobStatus.PENDING.value: 0,
            JobStatus.RUNNING.value: 0,
            JobStatus.COMPLETED.value: 0,
            JobStatus.FAILED.value: 0,
            JobStatus.PAUSED.value: 0,
            JobStatus.SCHEDULED.value: 0,
        }
        total_failovers = 0
        total_processed_videos = 0
        total_target_videos = 0

        for j in jobs:
            st = j.status.value if hasattr(j.status, "value") else str(j.status)
            if st in jobs_by_status:
                jobs_by_status[st] += 1
            else:
                jobs_by_status[st] = 1
            total_failovers += getattr(j, "failover_count", 0) or 0
            total_processed_videos += getattr(j, "processed_videos", 0) or 0
            total_target_videos += getattr(j, "total_videos", 0) or 0

        # 3. Deduplication Stats
        dedup_stats = {"total_fingerprints": 0, "total_deduplicated_items": 0, "estimated_saved_mb": 0.0}
        if hasattr(self.job_repository, "get_deduplication_stats"):
            try:
                dedup_stats = await self.job_repository.get_deduplication_stats()
            except Exception as e:
                logger.debug(f"Could not retrieve dedup stats: {e}")

        saved_bytes = int((dedup_stats.get("estimated_saved_mb", 0.0) or 0.0) * 1024 * 1024)

        # 4. Telegram MTProto Client Pool
        pool_accounts_total = 0
        pool_accounts_online = 0
        pool_accounts_cooldown = 0

        if self.client_pool:
            try:
                clients_map = getattr(self.client_pool, "clients", {})
                cooldowns_map = getattr(self.client_pool, "flood_wait_cooldowns", {})
                pool_accounts_total = len(clients_map)
                now = time.time()
                for acc_id in clients_map.keys():
                    cd_until = cooldowns_map.get(acc_id, 0.0)
                    if cd_until > now:
                        pool_accounts_cooldown += 1
                    else:
                        pool_accounts_online += 1
            except Exception as e:
                logger.debug(f"Could not inspect client pool metrics: {e}")

        # 5. Rate Governor Bandwidth Limit
        rate_limit_bytes_per_sec = 0
        rate_mode = "UNLIMITED"
        if self.rate_governor:
            try:
                gov_summary = self.rate_governor.get_summary()
                rate_limit_bytes_per_sec = gov_summary.get("limit_bytes_per_sec", 0)
                rate_mode = gov_summary.get("mode", "UNLIMITED")
            except Exception as e:
                logger.debug(f"Could not inspect rate governor: {e}")

        return {
            "uptime_seconds": uptime_seconds,
            "memory_rss_bytes": rss_bytes,
            "jobs": {
                "total": len(jobs),
                "by_status": jobs_by_status,
                "total_failovers": total_failovers,
                "total_processed_videos": total_processed_videos,
                "total_target_videos": total_target_videos,
            },
            "deduplication": {
                "fingerprints_indexed": dedup_stats.get("total_fingerprints", 0),
                "deduplicated_items": dedup_stats.get("total_deduplicated_items", 0),
                "saved_bytes": saved_bytes,
                "saved_mb": dedup_stats.get("estimated_saved_mb", 0.0),
            },
            "mtproto_pool": {
                "total_accounts": pool_accounts_total,
                "online_accounts": pool_accounts_online,
                "cooldown_accounts": pool_accounts_cooldown,
            },
            "rate_governor": {
                "mode": rate_mode,
                "limit_bytes_per_sec": rate_limit_bytes_per_sec,
            },
        }

    def format_prometheus(self, metrics: dict[str, Any]) -> str:
        """Format metrics into standard Prometheus OpenMetrics text exposition format."""
        lines: list[str] = [
            "# HELP telegram_migrator_uptime_seconds Total runtime of the application in seconds.",
            "# TYPE telegram_migrator_uptime_seconds gauge",
            f"telegram_migrator_uptime_seconds {metrics['uptime_seconds']}",
            "",
            "# HELP telegram_migrator_memory_rss_bytes Resident set size memory in bytes.",
            "# TYPE telegram_migrator_memory_rss_bytes gauge",
            f"telegram_migrator_memory_rss_bytes {metrics['memory_rss_bytes']}",
            "",
            "# HELP telegram_migrator_jobs_total Total migration jobs by status.",
            "# TYPE telegram_migrator_jobs_total gauge",
        ]

        for st, count in metrics["jobs"]["by_status"].items():
            lines.append(f'telegram_migrator_jobs_total{{status="{st}"}} {count}')

        lines.extend([
            "",
            "# HELP telegram_migrator_failovers_total Total hot-failover rotations executed across jobs.",
            "# TYPE telegram_migrator_failovers_total counter",
            f"telegram_migrator_failovers_total {metrics['jobs']['total_failovers']}",
            "",
            "# HELP telegram_migrator_videos_processed_total Total videos successfully processed.",
            "# TYPE telegram_migrator_videos_processed_total counter",
            f"telegram_migrator_videos_processed_total {metrics['jobs']['total_processed_videos']}",
            "",
            "# HELP telegram_migrator_deduplication_saved_bytes_total Total bandwidth bytes saved via zero-byte deduplication.",
            "# TYPE telegram_migrator_deduplication_saved_bytes_total counter",
            f"telegram_migrator_deduplication_saved_bytes_total {metrics['deduplication']['saved_bytes']}",
            "",
            "# HELP telegram_migrator_deduplication_fingerprints_indexed Total media fingerprints indexed.",
            "# TYPE telegram_migrator_deduplication_fingerprints_indexed gauge",
            f"telegram_migrator_deduplication_fingerprints_indexed {metrics['deduplication']['fingerprints_indexed']}",
            "",
            "# HELP telegram_migrator_bandwidth_limit_bytes_per_sec Configured rate limit in bytes/sec.",
            "# TYPE telegram_migrator_bandwidth_limit_bytes_per_sec gauge",
            f"telegram_migrator_bandwidth_limit_bytes_per_sec {metrics['rate_governor']['limit_bytes_per_sec']}",
            "",
            "# HELP telegram_migrator_telegram_accounts_total Telegram accounts in client pool by state.",
            "# TYPE telegram_migrator_telegram_accounts_total gauge",
            f'telegram_migrator_telegram_accounts_total{{status="online"}} {metrics["mtproto_pool"]["online_accounts"]}',
            f'telegram_migrator_telegram_accounts_total{{status="cooldown"}} {metrics["mtproto_pool"]["cooldown_accounts"]}',
            "",
        ])

        return "\n".join(lines) + "\n"

    async def evaluate_anomalies(self, dispatch_alerts: bool = True) -> list[dict[str, Any]]:
        """Evaluate operational health thresholds and dispatch alerts upon anomalies."""
        metrics = await self.collect_metrics()
        anomalies: list[dict[str, Any]] = []

        # 1. Check MTProto Account Pool Exhaustion
        pool = metrics["mtproto_pool"]
        if pool["total_accounts"] > 0 and pool["online_accounts"] == 0:
            anomalies.append({
                "code": "MTPROTO_POOL_EXHAUSTED",
                "severity": "CRITICAL",
                "title": "Alerta Crítica: Pool MTProto Agotado",
                "message": f"Todas las cuentas de Telegram ({pool['total_accounts']}) se encuentran temporalmente en FloodWait o cooldown.",
            })
        elif pool["cooldown_accounts"] > 0:
            anomalies.append({
                "code": "MTPROTO_COOLDOWN_ACTIVE",
                "severity": "WARNING",
                "title": "Aviso: Cuentas en Cooldown",
                "message": f"{pool['cooldown_accounts']} de {pool['total_accounts']} cuentas MTProto están en cooldown por FloodWait.",
            })

        # 2. Check Job Failure Spike
        jobs = metrics["jobs"]
        failed_count = jobs["by_status"].get(JobStatus.FAILED.value, 0)
        completed_count = jobs["by_status"].get(JobStatus.COMPLETED.value, 0)
        total_finished = failed_count + completed_count

        if total_finished >= 5 and (failed_count / total_finished) > 0.35:
            anomalies.append({
                "code": "HIGH_JOB_FAILURE_RATE",
                "severity": "ERROR",
                "title": "Tasa Elevada de Trabajos Fallidos",
                "message": f"Se registra un {(failed_count / total_finished) * 100:.1f}% de fallos ({failed_count} de {total_finished} trabajos finalizados).",
            })

        # Dispatch alerts if requested
        if dispatch_alerts and self.alerting_service and anomalies:
            for anom in anomalies:
                try:
                    await self.alerting_service.send_alert(
                        title=anom["title"],
                        message=anom["message"],
                        severity=anom["severity"],
                        event_type=f"anomaly.{anom['code'].lower()}",
                        metadata={"anomaly_code": anom["code"], "metrics": metrics},
                    )
                except Exception as e:
                    logger.warning(f"Failed to dispatch anomaly alert for {anom['code']}: {e}")

        return anomalies

    def get_grafana_dashboard(self) -> dict[str, Any]:
        """Return the pre-configured Grafana dashboard JSON specification."""
        import json
        from pathlib import Path

        resource_path = Path(__file__).resolve().parent.parent.parent / "resources" / "grafana_dashboard.json"
        if resource_path.exists():
            try:
                with open(resource_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Could not read grafana_dashboard.json from {resource_path}: {e}")

        # Fallback minimal schema
        return {
            "title": "Telegram Video Migrator - Enterprise Observability",
            "uid": "tg-migrator-overview",
            "schemaVersion": 38,
            "panels": [],
        }
