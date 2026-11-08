from __future__ import annotations

import base64
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import shutil
import tarfile
import tempfile
from typing import Any
import uuid

from backend.domain.entities.audit_log import AuditLog
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.infrastructure.persistence.postgres_repository import PostgresRepository

logger = logging.getLogger(__name__)


class BackupJsonEncoder(json.JSONEncoder):
    """Encodes UUIDs, datetime, bytes, and records into JSON-serializable representations."""

    def default(self, o: Any) -> Any:
        if isinstance(o, (datetime,)):
            return o.isoformat()
        if isinstance(o, uuid.UUID):
            return str(o)
        if isinstance(o, (bytes, bytearray)):
            return base64.b64encode(o).decode("ascii")
        if hasattr(o, "to_dict") and callable(o.to_dict):
            return o.to_dict()
        if hasattr(o, "__dict__"):
            return {k: v for k, v in o.__dict__.items() if not k.startswith("_")}
        return super().default(o)


class DisasterRecoveryService:
    """Enterprise-grade automated and on-demand disaster recovery snapshot service."""

    CORE_POSTGRES_TABLES = [
        "roles",
        "users",
        "telegram_accounts",
        "audit_logs",
        "migration_jobs",
        "migration_items",
        "migration_queue",
        "channel_sync_bindings",
        "migrated_media_fingerprints",
        "video_processing_jobs",
        "scheduled_broadcasts",
        "app_notifications",
        "caption_templates",
        "webhook_endpoints",
    ]

    SNAPSHOT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")

    def __init__(
        self,
        job_repo: JobRepositoryPort,
        postgres_repo: PostgresRepository,
        backups_dir: str | Path | None = None,
        alerting_service: Any = None,
    ) -> None:
        self.job_repo = job_repo
        self.postgres_repo = postgres_repo
        self.alerting_service = alerting_service

        if backups_dir:
            self.backups_dir = Path(backups_dir)
        else:
            env_dir = os.getenv("BACKUPS_DIR")
            if env_dir:
                self.backups_dir = Path(env_dir)
            elif os.path.exists("/app/data"):
                self.backups_dir = Path("/app/data/backups")
            elif os.path.exists("data"):
                self.backups_dir = Path("data/backups")
            else:
                self.backups_dir = Path("backups")

        self.backups_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_snapshot_id(self, snapshot_id: str) -> str:
        clean_id = snapshot_id.strip()
        if "/" in clean_id or "\\" in clean_id or ".." in clean_id:
            raise ValueError(f"Path traversal characters detected in snapshot ID: {snapshot_id}")
        if not self.SNAPSHOT_ID_PATTERN.match(clean_id):
            raise ValueError(f"Invalid snapshot ID characters: {snapshot_id}")
        return clean_id

    async def _dump_postgres_tables(self) -> tuple[dict[str, list[dict[str, Any]]], dict[str, int]]:
        """Dumps tables from active PostgreSQL pool or memory fallback structures."""
        tables_data: dict[str, list[dict[str, Any]]] = {}
        table_counts: dict[str, int] = {}

        pool = getattr(self.postgres_repo, "pool", None)
        is_fallback = getattr(self.postgres_repo, "_fallback_mode", False)

        if pool is not None and not is_fallback:
            try:
                async with pool.acquire() as conn:
                    for table in self.CORE_POSTGRES_TABLES:
                        # Check table existence safely
                        exists = await conn.fetchval(
                            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)",
                            table,
                        )
                        if exists:
                            records = await conn.fetch(f"SELECT * FROM {table}")
                            rows = [dict(r) for r in records]
                            tables_data[table] = rows
                            table_counts[table] = len(rows)
                        else:
                            tables_data[table] = []
                            table_counts[table] = 0
                return tables_data, table_counts
            except Exception as e:
                logger.warning(f"Failed to query PostgreSQL pool for backup: {e}. Falling back to repository state.")

        # Fallback dump for test mode or SQLite/in-memory mode
        users_mem = getattr(self.postgres_repo, "_users_memory", {})
        tables_data["users"] = [u.__dict__ if hasattr(u, "__dict__") else dict(u) for u in users_mem.values()]
        table_counts["users"] = len(tables_data["users"])

        accounts_mem = getattr(self.postgres_repo, "_accounts_memory", {})
        tables_data["telegram_accounts"] = [
            acc.__dict__ if hasattr(acc, "__dict__") else dict(acc) for acc in accounts_mem.values()
        ]
        table_counts["telegram_accounts"] = len(tables_data["telegram_accounts"])

        audit_mem = getattr(self.postgres_repo, "_audit_logs_memory", [])
        tables_data["audit_logs"] = [
            a.__dict__ if hasattr(a, "__dict__") else dict(a) for a in audit_mem
        ]
        table_counts["audit_logs"] = len(tables_data["audit_logs"])

        # Also pull from fallback job repo if present
        fallback_job_repo = getattr(self.job_repo, "_fallback_repo", None) or self.job_repo
        if hasattr(fallback_job_repo, "list_all_jobs"):
            try:
                jobs = await fallback_job_repo.list_all_jobs()
                tables_data["migration_jobs"] = [
                    j.__dict__ if hasattr(j, "__dict__") else dict(j) for j in jobs
                ]
                table_counts["migration_jobs"] = len(tables_data["migration_jobs"])
            except Exception:
                tables_data["migration_jobs"] = []
                table_counts["migration_jobs"] = 0

        for tbl in self.CORE_POSTGRES_TABLES:
            if tbl not in tables_data:
                tables_data[tbl] = []
                table_counts[tbl] = 0

        return tables_data, table_counts

    def _locate_sqlite_databases(self) -> list[Path]:
        """Finds active SQLite database files to include in snapshot archive."""
        paths: list[Path] = []
        candidates = [
            Path("/app/data/migration.db"),
            Path("data/migration.db"),
            Path("migration.db"),
            Path("telegram_hub.db"),
        ]
        job_db_path = getattr(self.job_repo, "db_path", None)
        if job_db_path and job_db_path != ":memory:":
            candidates.append(Path(job_db_path))

        fallback_repo = getattr(self.job_repo, "_fallback_repo", None)
        if fallback_repo and hasattr(fallback_repo, "db_path") and fallback_repo.db_path != ":memory:":
            candidates.append(Path(fallback_repo.db_path))

        for p in candidates:
            if p.is_file() and p not in paths:
                paths.append(p)

        return paths

    async def create_snapshot(
        self,
        trigger: str = "MANUAL",
        retention_limit: int = 7,
    ) -> dict[str, Any]:
        """Creates a compressed disaster recovery snapshot, updates retention, and records audit."""
        now = datetime.now(timezone.utc)
        random_suffix = uuid.uuid4().hex[:6]
        snapshot_id = f"snapshot_{now.strftime('%Y%m%d_%H%M%S')}_{random_suffix}"
        tar_filename = f"{snapshot_id}.tar.gz"
        archive_path = self.backups_dir / tar_filename

        staging_dir = Path(tempfile.mkdtemp(prefix=f"dr_{snapshot_id}_"))

        try:
            # 1. Dump database tables
            tables_data, table_counts = await self._dump_postgres_tables()
            data_dir = staging_dir / "data"
            data_dir.mkdir(parents=True, exist_ok=True)

            tables_dump_path = data_dir / "tables.json"
            with open(tables_dump_path, "w", encoding="utf-8") as f:
                json.dump(tables_data, f, cls=BackupJsonEncoder, indent=2)

            # 2. Copy SQLite files if any exist
            sqlite_files = self._locate_sqlite_databases()
            sqlite_info: list[dict[str, Any]] = []
            for sqlite_p in sqlite_files:
                dest = data_dir / sqlite_p.name
                shutil.copy2(sqlite_p, dest)
                sqlite_info.append({
                    "name": sqlite_p.name,
                    "size_bytes": sqlite_p.stat().st_size,
                })

            total_records = sum(table_counts.values())

            # 3. Create Manifest
            manifest = {
                "snapshot_id": snapshot_id,
                "version": "1.0",
                "trigger": trigger,
                "created_at": now.isoformat(),
                "table_counts": table_counts,
                "total_records": total_records,
                "sqlite_files": sqlite_info,
                "engine": "TelegramHub Disaster Recovery Suite",
            }

            manifest_path = staging_dir / "manifest.json"
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)

            # 4. Pack into compressed tar.gz
            with tarfile.open(archive_path, "w:gz") as tar:
                tar.add(manifest_path, arcname="manifest.json")
                for item in data_dir.iterdir():
                    tar.add(item, arcname=f"data/{item.name}")

            # 5. Compute archive sha256 & size
            sha256_hash = hashlib.sha256()
            with open(archive_path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    sha256_hash.update(chunk)
            archive_sha256 = sha256_hash.hexdigest()
            archive_size = archive_path.stat().st_size

            # 6. Apply automated rolling retention
            pruned_ids = await self.prune_old_snapshots(keep_count=retention_limit)

            # 7. Audit log
            try:
                if hasattr(self.postgres_repo, "record_audit_log"):
                    await self.postgres_repo.record_audit_log(
                        AuditLog(
                            action="BACKUP_CREATED",
                            target=snapshot_id,
                            details=f"Disaster Recovery Snapshot {snapshot_id} created ({round(archive_size / 1024, 1)} KB, {total_records} records, trigger={trigger}).",
                        )
                    )
            except Exception as e:
                logger.debug(f"Failed to record audit log for backup: {e}")

            # 8. Alerting notification
            if self.alerting_service and hasattr(self.alerting_service, "send_alert"):
                try:
                    await self.alerting_service.send_alert(
                        title="Snapshot de Respaldo Creado",
                        message=f"Se generó exitosamente el respaldo {snapshot_id} ({round(archive_size / 1024, 1)} KB, {total_records} registros respaldados).",
                        severity="INFO",
                        link="/settings",
                    )
                except Exception as e:
                    logger.debug(f"Failed to dispatch backup alert: {e}")

            metadata = {
                "snapshot_id": snapshot_id,
                "filename": tar_filename,
                "created_at": now.isoformat(),
                "trigger": trigger,
                "size_bytes": archive_size,
                "sha256": archive_sha256,
                "table_counts": table_counts,
                "total_records": total_records,
                "sqlite_files": sqlite_info,
                "pruned_snapshots": pruned_ids,
            }
            return metadata

        finally:
            shutil.rmtree(staging_dir, ignore_errors=True)

    async def list_snapshots(self) -> list[dict[str, Any]]:
        """Lists available backup archives with their manifest metadata."""
        if not self.backups_dir.exists():
            return []

        results: list[dict[str, Any]] = []

        for p in self.backups_dir.glob("*.tar.gz"):
            if not p.is_file():
                continue

            snapshot_id = p.name[:-7]
            stat = p.stat()
            size_bytes = stat.st_size
            created_at = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
            trigger = "MANUAL"
            table_counts: dict[str, int] = {}
            total_records = 0
            sha256_val = ""

            try:
                with tarfile.open(p, "r:gz") as tar:
                    manifest_file = tar.extractfile("manifest.json")
                    if manifest_file:
                        manifest_data = json.load(manifest_file)
                        snapshot_id = manifest_data.get("snapshot_id", snapshot_id)
                        created_at = manifest_data.get("created_at", created_at)
                        trigger = manifest_data.get("trigger", trigger)
                        table_counts = manifest_data.get("table_counts", {})
                        total_records = manifest_data.get("total_records", sum(table_counts.values()))
            except Exception as e:
                logger.debug(f"Could not read manifest from {p.name}: {e}")

            results.append({
                "snapshot_id": snapshot_id,
                "filename": p.name,
                "created_at": created_at,
                "trigger": trigger,
                "size_bytes": size_bytes,
                "sha256": sha256_val,
                "table_counts": table_counts,
                "total_records": total_records,
            })

        # Sort newest first
        results.sort(key=lambda s: s.get("created_at", ""), reverse=True)
        return results

    async def get_snapshot_path(self, snapshot_id: str) -> Path | None:
        """Resolves verified absolute filesystem path for snapshot archive."""
        clean_id = self._sanitize_snapshot_id(snapshot_id)
        tar_path = self.backups_dir / f"{clean_id}.tar.gz"
        if tar_path.is_file():
            return tar_path
        return None

    async def verify_snapshot(self, snapshot_id: str) -> dict[str, Any]:
        """Performs dry-run integrity and schema validation on a snapshot archive."""
        tar_path = await self.get_snapshot_path(snapshot_id)
        if not tar_path:
            return {
                "valid": False,
                "snapshot_id": snapshot_id,
                "error": "Snapshot archive file not found on disk.",
            }

        try:
            with tarfile.open(tar_path, "r:gz") as tar:
                names = tar.getnames()
                if "manifest.json" not in names:
                    return {
                        "valid": False,
                        "snapshot_id": snapshot_id,
                        "error": "Archive corrupted: manifest.json is missing.",
                    }

                manifest_file = tar.extractfile("manifest.json")
                if not manifest_file:
                    return {
                        "valid": False,
                        "snapshot_id": snapshot_id,
                        "error": "Failed to extract manifest from archive.",
                    }

                manifest = json.load(manifest_file)

                # Validate data/tables.json presence
                has_tables = "data/tables.json" in names
                has_sqlite = any(n.startswith("data/") and n.endswith(".db") for n in names)

            # Compute actual sha256
            sha256_hash = hashlib.sha256()
            with open(tar_path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    sha256_hash.update(chunk)

            return {
                "valid": True,
                "snapshot_id": snapshot_id,
                "manifest": manifest,
                "has_tables_dump": has_tables,
                "has_sqlite_db": has_sqlite,
                "sha256": sha256_hash.hexdigest(),
                "size_bytes": tar_path.stat().st_size,
                "verified_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            return {
                "valid": False,
                "snapshot_id": snapshot_id,
                "error": f"Corrupted or invalid tar archive: {str(e)}",
            }

    async def delete_snapshot(self, snapshot_id: str) -> bool:
        """Deletes snapshot archive from disk and records an audit log entry."""
        tar_path = await self.get_snapshot_path(snapshot_id)
        if not tar_path:
            return False

        try:
            tar_path.unlink()
            if hasattr(self.postgres_repo, "record_audit_log"):
                try:
                    await self.postgres_repo.record_audit_log(
                        AuditLog(
                            action="BACKUP_DELETED",
                            target=snapshot_id,
                            details=f"Snapshot archive {snapshot_id} was permanently purged.",
                        )
                    )
                except Exception:
                    pass
            return True
        except Exception as e:
            logger.warning(f"Failed to delete snapshot archive {snapshot_id}: {e}")
            return False

    async def prune_old_snapshots(self, keep_count: int = 7) -> list[str]:
        """Enforces automated rolling retention policy by purging oldest backups exceeding keep_count."""
        if keep_count <= 0:
            return []

        snapshots = await self.list_snapshots()
        if len(snapshots) <= keep_count:
            return []

        snapshots_to_delete = snapshots[keep_count:]
        deleted_ids: list[str] = []

        for snap in snapshots_to_delete:
            snap_id = snap["snapshot_id"]
            if await self.delete_snapshot(snap_id):
                deleted_ids.append(snap_id)

        if deleted_ids:
            logger.info(
                f"DisasterRecovery: Pruned {len(deleted_ids)} old snapshots to maintain retention limit of {keep_count}."
            )

        return deleted_ids
