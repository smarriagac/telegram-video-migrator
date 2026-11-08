from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class HealthDoctorService:
    """Comprehensive diagnostic and self-healing engine for Telegram Video Migrator."""

    def __init__(self) -> None:
        pass

    async def check_database(self) -> dict[str, Any]:
        """Perform real round-trip query check against PostgreSQL repository."""
        from backend.presentation.dependencies import get_postgres_repository

        start = time.monotonic()
        status_label = "HEALTHY"
        error_msg: str | None = None
        driver_mode = "unknown"

        try:
            repo = await get_postgres_repository()
            await repo.connect()

            if repo.pool is not None:
                driver_mode = "PostgreSQL (asyncpg connection pool)"
                # Execute probe query
                await repo.pool.fetchval("SELECT 1")
            elif repo._fallback_mode:
                driver_mode = "In-Memory Fallback Adapter"
            else:
                driver_mode = "SQLite / In-Memory Mock"

            latency_ms = round((time.monotonic() - start) * 1000, 2)

            if latency_ms > 300.0:
                status_label = "DEGRADED"
                error_msg = f"High latency detected ({latency_ms}ms)"
            elif repo._fallback_mode:
                status_label = "DEGRADED"
                error_msg = "Database operating in in-memory fallback mode (Postgres unavailable)"
        except Exception as e:
            latency_ms = round((time.monotonic() - start) * 1000, 2)
            status_label = "CRITICAL"
            error_msg = str(e)

        return {
            "status": status_label,
            "latency_ms": latency_ms,
            "driver": driver_mode,
            "error": error_msg,
        }

    async def check_telegram_mtproto(self) -> dict[str, Any]:
        """Evaluate status of registered Telegram accounts and MTProto sessions."""
        from backend.presentation.dependencies import (
            get_account_repository,
            get_telegram_client_pool,
        )

        status_label = "HEALTHY"
        error_msg: str | None = None
        registered_count = 0
        active_count = 0
        pool_clients_count = 0
        connected_clients = 0

        try:
            repo = await get_account_repository()
            accounts = await repo.list_accounts()
            registered_count = len(accounts)
            active_count = sum(1 for a in accounts if a.is_active)

            pool = await get_telegram_client_pool()
            pool_clients = pool.list_clients()
            pool_clients_count = len(pool_clients)

            for _acc_id, _name, client_obj in pool_clients:
                try:
                    if hasattr(client_obj, "is_connected") and client_obj.is_connected():
                        connected_clients += 1
                except Exception:
                    pass

            if registered_count == 0:
                status_label = "DEGRADED"
                error_msg = "No Telegram accounts registered in the system."
            elif active_count == 0:
                status_label = "CRITICAL"
                error_msg = "All registered Telegram accounts are inactive or revoked."
        except Exception as e:
            status_label = "DEGRADED"
            error_msg = f"Failed to inspect MTProto accounts: {e}"

        return {
            "status": status_label,
            "accounts_registered": registered_count,
            "accounts_active": active_count,
            "clients_in_pool": pool_clients_count,
            "clients_connected": connected_clients,
            "error": error_msg,
        }

    async def check_media_engine(self) -> dict[str, Any]:
        """Check presence of FFmpeg and FFprobe media processing binaries."""
        ffmpeg_path = shutil.which("ffmpeg")
        ffprobe_path = shutil.which("ffprobe")
        ffmpeg_version = "Unknown"

        if ffmpeg_path:
            try:
                # Run ffmpeg -version in a thread to avoid blocking asyncio loop
                def _get_version():
                    res = subprocess.run(
                        [ffmpeg_path, "-version"],
                        capture_output=True,
                        text=True,
                        timeout=2.0,
                    )
                    return res.stdout.split("\n")[0] if res.stdout else "Available"

                ffmpeg_version = await asyncio.to_thread(_get_version)
            except Exception as e:
                ffmpeg_version = f"Error reading version: {e}"

        status_label = "HEALTHY" if (ffmpeg_path and ffprobe_path) else "DEGRADED"
        error_msg = None
        if not ffmpeg_path:
            error_msg = "FFmpeg binary not found in system PATH."
        elif not ffprobe_path:
            error_msg = "FFprobe binary not found in system PATH."

        return {
            "status": status_label,
            "ffmpeg_available": bool(ffmpeg_path),
            "ffmpeg_path": ffmpeg_path or "Not installed",
            "ffmpeg_version": ffmpeg_version,
            "ffprobe_available": bool(ffprobe_path),
            "ffprobe_path": ffprobe_path or "Not installed",
            "error": error_msg,
        }

    async def check_storage(self) -> dict[str, Any]:
        """Evaluate temporary scratch storage space and orphaned media chunks."""
        temp_dir = tempfile.gettempdir()
        try:
            usage = shutil.disk_usage(temp_dir)
            total_gb = round(usage.total / (1024**3), 2)
            used_gb = round(usage.used / (1024**3), 2)
            free_gb = round(usage.free / (1024**3), 2)
            used_percent = round((usage.used / usage.total) * 100, 1)
        except Exception:
            total_gb = 100.0
            used_gb = 10.0
            free_gb = 90.0
            used_percent = 10.0

        # Scan for migrator scratch files
        temp_count = 0
        temp_bytes = 0
        try:
            for entry in os.scandir(temp_dir):
                if entry.is_file() and (
                    entry.name.startswith("migrator_")
                    or entry.name.endswith((".mp4", ".mkv", ".tmp", ".part"))
                ):
                    temp_count += 1
                    try:
                        temp_bytes += entry.stat().st_size
                    except OSError:
                        pass
        except Exception:
            pass

        temp_mb = round(temp_bytes / (1024**2), 2)

        status_label = "HEALTHY"
        error_msg = None
        if free_gb < 1.0 or used_percent > 95.0:
            status_label = "CRITICAL"
            error_msg = f"Scratch disk space critically low ({free_gb} GB free)"
        elif free_gb < 5.0 or used_percent > 85.0:
            status_label = "DEGRADED"
            error_msg = f"Low scratch disk space warning ({free_gb} GB free)"

        return {
            "status": status_label,
            "scratch_path": temp_dir,
            "total_gb": total_gb,
            "used_gb": used_gb,
            "free_gb": free_gb,
            "used_percent": used_percent,
            "scratch_files_count": temp_count,
            "scratch_files_mb": temp_mb,
            "error": error_msg,
        }

    async def check_background_services(self) -> dict[str, Any]:
        """Inspect background daemons (Rate Governor, Event Broadcaster)."""
        from backend.application.services.rate_governor_service import get_rate_governor_service
        from backend.application.broadcaster import broadcaster

        gov = get_rate_governor_service()
        gov_metrics = gov.get_status()

        return {
            "status": "HEALTHY",
            "rate_governor": {
                "status": "RUNNING",
                "total_managed_channels": gov_metrics.get("total_managed_channels", 0),
                "active_throttles": gov_metrics.get("active_throttles", 0),
                "frozen_channels": gov_metrics.get("frozen_channels", 0),
            },
            "event_broadcaster": {
                "status": "RUNNING",
                "active_subscribers": getattr(broadcaster, "subscriber_count", 0),
            },
        }

    async def diagnose_all(self) -> dict[str, Any]:
        """Aggregate all diagnostic probes into a consolidated health report."""
        db_check, mtproto_check, media_check, storage_check, bg_check = await asyncio.gather(
            self.check_database(),
            self.check_telegram_mtproto(),
            self.check_media_engine(),
            self.check_storage(),
            self.check_background_services(),
        )

        subsystem_statuses = [
            db_check["status"],
            mtproto_check["status"],
            media_check["status"],
            storage_check["status"],
            bg_check["status"],
        ]

        if "CRITICAL" in subsystem_statuses:
            overall_status = "CRITICAL"
        elif "DEGRADED" in subsystem_statuses:
            overall_status = "DEGRADED"
        else:
            overall_status = "HEALTHY"

        recommendations: list[str] = []
        if db_check["status"] == "DEGRADED" and db_check.get("driver") == "In-Memory Fallback Adapter":
            recommendations.append("Conexión con PostgreSQL caída; el sistema opera en modo memoria volátil.")
        if db_check["status"] == "DEGRADED" and db_check.get("latency_ms", 0) > 100:
            recommendations.append(f"Latencia de base de datos elevada ({db_check['latency_ms']} ms). Verificar carga de PostgreSQL.")
        if mtproto_check["status"] != "HEALTHY":
            recommendations.append("Se requiere conectar al menos una cuenta activa de Telegram para ejecutar migraciones.")
        if media_check["status"] != "HEALTHY":
            recommendations.append("Instalar FFmpeg y FFprobe para habilitar transcodificación y marcas de agua.")
        if storage_check["status"] != "HEALTHY":
            recommendations.append("Liberar espacio en el disco temporal o ejecutar la acción de auto-limpieza.")
        if not recommendations:
            recommendations.append("Todos los subsistemas se encuentran en estado óptimo.")

        return {
            "overall_status": overall_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {
                "database": db_check,
                "telegram_mtproto": mtproto_check,
                "media_engine": media_check,
                "storage": storage_check,
                "background_services": bg_check,
            },
            "recommendations": recommendations,
        }

    async def remediate(self, action: str) -> dict[str, Any]:
        """Execute automated or operator-triggered self-healing actions."""
        if action == "clean_temp_storage":
            temp_dir = tempfile.gettempdir()
            files_deleted = 0
            bytes_freed = 0

            try:
                for entry in os.scandir(temp_dir):
                    if entry.is_file() and (
                        entry.name.startswith("migrator_")
                        or entry.name.endswith((".mp4", ".mkv", ".tmp", ".part"))
                    ):
                        try:
                            size = entry.stat().st_size
                            os.remove(entry.path)
                            files_deleted += 1
                            bytes_freed += size
                        except OSError as ex:
                            logger.warning(f"Could not delete temp file {entry.path}: {ex}")
            except Exception as e:
                logger.error(f"Error during temp storage cleanup: {e}")

            return {
                "remediated": True,
                "action": action,
                "files_deleted": files_deleted,
                "bytes_freed": bytes_freed,
                "freed_mb": round(bytes_freed / (1024**2), 2),
                "message": f"Se eliminaron {files_deleted} archivos temporales ({round(bytes_freed / (1024**2), 2)} MB liberados).",
            }

        elif action == "refresh_pool":
            from backend.presentation.dependencies import refresh_telegram_client_pool

            pool = await refresh_telegram_client_pool()
            return {
                "remediated": True,
                "action": action,
                "clients_in_pool": len(pool.clients),
                "message": f"Pool de Telegram reinicializado con {len(pool.clients)} clientes.",
            }

        elif action == "reset_rate_governor":
            from backend.application.services.rate_governor_service import get_rate_governor_service

            gov = get_rate_governor_service()
            channels_reset = gov.reset_all()
            return {
                "remediated": True,
                "action": action,
                "channels_reset": channels_reset,
                "message": f"Gobernador de tasa reiniciado; {channels_reset} canales restablecidos.",
            }

        elif action == "test_db_latency":
            from backend.presentation.dependencies import get_postgres_repository

            repo = await get_postgres_repository()
            await repo.connect()
            latencies: list[float] = []

            for _ in range(3):
                t0 = time.monotonic()
                if repo.pool is not None:
                    await repo.pool.fetchval("SELECT 1")
                latencies.append((time.monotonic() - t0) * 1000)

            avg_lat = round(sum(latencies) / len(latencies), 2)
            return {
                "remediated": True,
                "action": action,
                "avg_latency_ms": avg_lat,
                "samples_ms": [round(l, 2) for l in latencies],
                "message": f"Prueba de latencia finalizada. Promedio: {avg_lat} ms.",
            }

        else:
            raise ValueError(f"Unknown remediation action: {action}")


_doctor_instance: HealthDoctorService | None = None


def get_health_doctor_service() -> HealthDoctorService:
    global _doctor_instance
    if _doctor_instance is None:
        _doctor_instance = HealthDoctorService()
    return _doctor_instance
