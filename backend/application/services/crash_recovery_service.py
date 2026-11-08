from __future__ import annotations

from dataclasses import dataclass
import glob
import logging
import os
import tempfile
import time
from typing import Any

from backend.domain.ports.job_repository_port import JobRepositoryPort

logger = logging.getLogger(__name__)


@dataclass
class RecoveryReport:
    """Summary of entities and temporary disk resources rescued during crash recovery."""

    orphaned_jobs_count: int = 0
    orphaned_queue_items_count: int = 0
    orphaned_broadcasts_count: int = 0
    orphaned_video_jobs_count: int = 0
    temp_files_deleted: int = 0
    bytes_freed: int = 0

    @property
    def total_entities_rescued(self) -> int:
        return (
            self.orphaned_jobs_count
            + self.orphaned_queue_items_count
            + self.orphaned_broadcasts_count
            + self.orphaned_video_jobs_count
        )

    @property
    def megabytes_freed(self) -> float:
        return round(self.bytes_freed / (1024 * 1024), 2)

    def to_dict(self) -> dict[str, Any]:
        return {
            "orphaned_jobs_count": self.orphaned_jobs_count,
            "orphaned_queue_items_count": self.orphaned_queue_items_count,
            "orphaned_broadcasts_count": self.orphaned_broadcasts_count,
            "orphaned_video_jobs_count": self.orphaned_video_jobs_count,
            "temp_files_deleted": self.temp_files_deleted,
            "bytes_freed": self.bytes_freed,
            "megabytes_freed": self.megabytes_freed,
            "total_entities_rescued": self.total_entities_rescued,
        }


class DiskOrphanSweeper:
    """Scans and cleans leftover temporary video/media files on disk after process crashes."""

    RECOGNIZED_PREFIXES = ("tmp", "tg_", "watermark_", "thumb_", "export_", "frame_")
    RECOGNIZED_EXTENSIONS = (
        ".mp4",
        ".mkv",
        ".avi",
        ".mov",
        ".webm",
        ".part",
        ".jpg",
        ".jpeg",
        ".png",
        ".tmp",
    )

    def __init__(self, target_dir: str | None = None) -> None:
        self.target_dir = target_dir or tempfile.gettempdir()

    def sweep(self, min_age_seconds: int = 0) -> tuple[int, int]:
        """
        Removes abandoned temporary files matching known media prefixes/suffixes.
        Returns (files_deleted, bytes_freed).
        """
        if not os.path.exists(self.target_dir) or not os.path.isdir(self.target_dir):
            return 0, 0

        now = time.time()
        files_deleted = 0
        bytes_freed = 0

        try:
            entries = os.listdir(self.target_dir)
        except Exception as e:
            logger.warning(f"Could not list directory {self.target_dir} for sweeping: {e}")
            return 0, 0

        for filename in entries:
            file_path = os.path.join(self.target_dir, filename)

            # Skip directories and symlinks for safety
            if not os.path.isfile(file_path) or os.path.islink(file_path):
                continue

            lower_name = filename.lower()

            # Must match at least one temporary prefix and media extension
            matches_prefix = any(lower_name.startswith(p) for p in self.RECOGNIZED_PREFIXES)
            matches_ext = any(lower_name.endswith(e) for e in self.RECOGNIZED_EXTENSIONS)

            if not (matches_prefix and matches_ext):
                continue

            # Respect min_age_seconds guard
            try:
                stat = os.stat(file_path)
                if min_age_seconds > 0 and (now - stat.st_mtime) < min_age_seconds:
                    continue

                file_size = stat.st_size
                os.remove(file_path)
                files_deleted += 1
                bytes_freed += file_size
            except Exception as e:
                logger.debug(f"Could not remove orphaned temp file {file_path}: {e}")

        return files_deleted, bytes_freed


class CrashRecoveryService:
    """Orchestrates database state reconciliation and filesystem sweeping after server restart."""

    def __init__(
        self,
        job_repo: JobRepositoryPort,
        alerting_service: Any = None,
        sweeper: DiskOrphanSweeper | None = None,
    ) -> None:
        self.job_repo = job_repo
        self.alerting_service = alerting_service
        self.sweeper = sweeper or DiskOrphanSweeper()

    async def run_recovery(
        self,
        clean_temp_files: bool = True,
        min_temp_age_seconds: int = 0,
    ) -> RecoveryReport:
        """Executes comprehensive crash recovery across database tables and temp disk files."""
        report = RecoveryReport()

        # 1. Reconcile Migration Jobs (RUNNING -> PAUSED)
        try:
            report.orphaned_jobs_count = await self.job_repo.reconcile_orphaned_jobs()
        except Exception as e:
            logger.warning(f"CrashRecovery: Failed to reconcile jobs: {e}")

        # 2. Reconcile Queue Items (IN_PROGRESS -> PENDING)
        try:
            report.orphaned_queue_items_count = await self.job_repo.reconcile_orphaned_queue_items()
        except Exception as e:
            logger.warning(f"CrashRecovery: Failed to reconcile queue items: {e}")

        # 3. Reconcile Broadcasts (RUNNING -> SCHEDULED)
        try:
            report.orphaned_broadcasts_count = await self.job_repo.reconcile_orphaned_broadcasts()
        except Exception as e:
            logger.warning(f"CrashRecovery: Failed to reconcile broadcasts: {e}")

        # 4. Reconcile Video Processing Jobs (PROCESSING -> FAILED)
        try:
            report.orphaned_video_jobs_count = await self.job_repo.reconcile_orphaned_video_processing_jobs()
        except Exception as e:
            logger.warning(f"CrashRecovery: Failed to reconcile video processing jobs: {e}")

        # 5. Clean Orphaned Temp Media Files on Disk
        if clean_temp_files:
            try:
                deleted, freed = self.sweeper.sweep(min_age_seconds=min_temp_age_seconds)
                report.temp_files_deleted = deleted
                report.bytes_freed = freed
            except Exception as e:
                logger.warning(f"CrashRecovery: Failed to sweep temp files: {e}")

        # 6. Log and Notify if any orphans or files were rescued
        if report.total_entities_rescued > 0 or report.temp_files_deleted > 0:
            logger.info(
                f"CrashRecovery completed: {report.orphaned_jobs_count} jobs paused, "
                f"{report.orphaned_queue_items_count} queue items reset, "
                f"{report.orphaned_broadcasts_count} broadcasts rescheduled, "
                f"{report.orphaned_video_jobs_count} video tasks resolved, "
                f"{report.temp_files_deleted} temp files removed ({report.megabytes_freed} MB freed)."
            )

            # Trigger operational alert & in-app notification
            if self.alerting_service and hasattr(self.alerting_service, "send_alert"):
                try:
                    summary_lines = []
                    if report.orphaned_jobs_count > 0:
                        summary_lines.append(f"• {report.orphaned_jobs_count} trabajos migratorios pausados para reanudación segura.")
                    if report.orphaned_queue_items_count > 0:
                        summary_lines.append(f"• {report.orphaned_queue_items_count} videos en cola restablecidos a estado PENDIENTE.")
                    if report.orphaned_broadcasts_count > 0:
                        summary_lines.append(f"• {report.orphaned_broadcasts_count} campañas de difusión reprogramadas.")
                    if report.orphaned_video_jobs_count > 0:
                        summary_lines.append(f"• {report.orphaned_video_jobs_count} tareas de video interrumpidas marcadas.")
                    if report.temp_files_deleted > 0:
                        summary_lines.append(f"• {report.temp_files_deleted} archivos temporales huérfanos eliminados ({report.megabytes_freed} MB liberados).")

                    details = (
                        "El sistema se reinició y el módulo de Crash Recovery restauró el estado operativo:\n"
                        + "\n".join(summary_lines)
                    )

                    await self.alerting_service.send_alert(
                        title="Recuperación del Sistema: Crash Recovery",
                        message=details,
                        severity="WARNING",
                        link="/jobs",
                    )
                except Exception as e:
                    logger.debug(f"CrashRecovery: Failed to send operational alert: {e}")

        return report
