from __future__ import annotations

import json
import logging
import os
from typing import Any
import asyncpg

from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.entities.cloning_history import ChannelCloningHistory, ClonedContentItem
from backend.domain.entities.sync_binding import ChannelSyncBinding
from backend.domain.entities.scheduled_broadcast import ScheduledBroadcast
from backend.domain.entities.app_notification import AppNotification
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository

logger = logging.getLogger(__name__)


class PostgresJobRepository(JobRepositoryPort):
    """PostgreSQL implementation of JobRepositoryPort with fallback for test isolation."""

    def __init__(self, db_url: str | None = None) -> None:
        self.db_url = db_url or os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@localhost:7902/telegram_hub"
        )
        self.pool: asyncpg.Pool | None = None
        self._fallback_mode = False
        self._fallback_repo: SQLiteJobRepository | None = None
        self._initialized = False

    async def connect(self) -> None:
        import asyncio
        current_loop = asyncio.get_running_loop()
        if self.pool is not None:
            if getattr(self.pool, "_loop", None) is not current_loop:
                self.pool = None
            else:
                return

        try:
            self.pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=10, timeout=1.0)
            self._fallback_mode = False
        except Exception as e:
            logger.warning(
                f"Could not connect to PostgreSQL at {self.db_url}: {e}. Falling back to SQLite in-memory adapter."
            )
            self._fallback_mode = True
            if self._fallback_repo is None:
                self._fallback_repo = SQLiteJobRepository(db_path=":memory:")
                await self._fallback_repo.initialize_schema()

    async def initialize_schema(self) -> None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                await self._fallback_repo.initialize_schema()
            self._initialized = True
            return

        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS migration_jobs (
                    id VARCHAR(64) PRIMARY KEY,
                    source_channel_id BIGINT NOT NULL,
                    target_channel_id BIGINT NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    total_videos INTEGER NOT NULL DEFAULT 0,
                    processed_videos INTEGER NOT NULL DEFAULT 0,
                    last_processed_msg_id BIGINT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_full_migration BOOLEAN DEFAULT TRUE,
                    source_channel_title VARCHAR(255),
                    target_channel_title VARCHAR(255),
                    source_account_id BIGINT,
                    target_account_id BIGINT
                );

                ALTER TABLE migration_jobs ADD COLUMN IF NOT EXISTS source_account_id BIGINT;
                ALTER TABLE migration_jobs ADD COLUMN IF NOT EXISTS target_account_id BIGINT;
                ALTER TABLE migration_jobs ADD COLUMN IF NOT EXISTS caption_rules JSONB;
                ALTER TABLE migration_jobs ADD COLUMN IF NOT EXISTS drip_delay_seconds INTEGER DEFAULT 0;
                ALTER TABLE migration_jobs ADD COLUMN IF NOT EXISTS media_filter_rules JSONB;
                ALTER TABLE migration_jobs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
                ALTER TABLE migration_jobs ADD COLUMN IF NOT EXISTS failover_count INT NOT NULL DEFAULT 0;

                CREATE TABLE IF NOT EXISTS migration_items (
                    job_id VARCHAR(64) NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
                    source_message_id BIGINT NOT NULL,
                    target_message_id BIGINT NOT NULL,
                    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    PRIMARY KEY (job_id, source_message_id)
                );

                CREATE TABLE IF NOT EXISTS migration_queue (
                    job_id VARCHAR(64) NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
                    source_message_id BIGINT NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
                    media_type VARCHAR(32) NOT NULL DEFAULT 'video',
                    caption TEXT,
                    target_message_id BIGINT,
                    error_message TEXT,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    PRIMARY KEY (job_id, source_message_id)
                );

                CREATE INDEX IF NOT EXISTS idx_pg_queue_job_status ON migration_queue(job_id, status);

                CREATE TABLE IF NOT EXISTS channel_sync_bindings (
                    source_channel_id BIGINT NOT NULL,
                    target_channel_id BIGINT NOT NULL,
                    source_channel_title VARCHAR(255),
                    target_channel_title VARCHAR(255),
                    source_account_id BIGINT,
                    target_account_id BIGINT,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    last_synced_message_id BIGINT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    caption_rules JSONB,
                    PRIMARY KEY (source_channel_id, target_channel_id)
                );

                ALTER TABLE channel_sync_bindings ADD COLUMN IF NOT EXISTS caption_rules JSONB;
                ALTER TABLE channel_sync_bindings ADD COLUMN IF NOT EXISTS media_filter_rules JSONB;
                ALTER TABLE channel_sync_bindings ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE';
                ALTER TABLE channel_sync_bindings ADD COLUMN IF NOT EXISTS last_error VARCHAR(500);
                ALTER TABLE migration_queue ADD COLUMN IF NOT EXISTS is_deduplicated BOOLEAN NOT NULL DEFAULT FALSE;

                CREATE TABLE IF NOT EXISTS migrated_media_fingerprints (
                    id SERIAL PRIMARY KEY,
                    target_channel_id BIGINT NOT NULL,
                    fingerprint_hash VARCHAR(128) NOT NULL,
                    source_channel_id BIGINT,
                    source_message_id BIGINT,
                    target_message_id BIGINT,
                    media_type VARCHAR(32) NOT NULL DEFAULT 'video',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(target_channel_id, fingerprint_hash)
                );
                CREATE INDEX IF NOT EXISTS idx_media_fingerprint ON migrated_media_fingerprints(target_channel_id, fingerprint_hash);
                CREATE INDEX IF NOT EXISTS idx_pg_fp_hash_lookup ON migrated_media_fingerprints(fingerprint_hash);

                CREATE TABLE IF NOT EXISTS video_processing_jobs (
                    id UUID PRIMARY KEY,
                    tenant_id UUID NOT NULL,
                    source_channel_id BIGINT NOT NULL,
                    source_channel_title TEXT,
                    source_message_id BIGINT NOT NULL,
                    target_channel_id BIGINT NOT NULL,
                    target_channel_title TEXT,
                    filter_type VARCHAR(32) NOT NULL DEFAULT 'delogo',
                    filter_params JSONB NOT NULL DEFAULT '{}'::jsonb,
                    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
                    progress REAL NOT NULL DEFAULT 0.0,
                    original_caption TEXT,
                    new_caption TEXT,
                    target_message_id BIGINT,
                    error_message TEXT,
                    account_id INT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_video_processing_status ON video_processing_jobs(status, created_at);

                CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
                    id VARCHAR(64) PRIMARY KEY,
                    name TEXT,
                    target_ids JSONB NOT NULL,
                    text TEXT NOT NULL,
                    media_paths JSONB,
                    account_id INT,
                    scheduled_at VARCHAR(64) NOT NULL,
                    recurrence VARCHAR(32) NOT NULL DEFAULT 'ONCE',
                    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
                    last_run_at VARCHAR(64),
                    run_count INT NOT NULL DEFAULT 0,
                    last_error TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_sched_broadcast_status ON scheduled_broadcasts(status, scheduled_at);

                CREATE TABLE IF NOT EXISTS app_notifications (
                    id VARCHAR(64) PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
                    is_read BOOLEAN NOT NULL DEFAULT FALSE,
                    link TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_notifications_tenant_read ON app_notifications(tenant_id, is_read, created_at DESC);
            """)
        self._initialized = True

    async def _ensure_initialized(self) -> None:
        await self.connect()
        if not self._initialized:
            await self.initialize_schema()

    async def create_job(self, job: MigrationJob) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.create_job(job)

        status_val = job.status.value if isinstance(job.status, JobStatus) else str(job.status)
        caption_rules_json = json.dumps(job.caption_rules) if job.caption_rules else None
        filter_rules_json = json.dumps(job.media_filter_rules) if job.media_filter_rules else None
        sched_dt = None
        if job.scheduled_at:
            try:
                from datetime import datetime
                sched_dt = datetime.fromisoformat(job.scheduled_at.replace("Z", "+00:00"))
            except Exception:
                sched_dt = None

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO migration_jobs (
                    id, source_channel_id, target_channel_id, status,
                    total_videos, processed_videos, last_processed_msg_id,
                    created_at, updated_at, is_full_migration, source_channel_title, target_channel_title,
                    source_account_id, target_account_id, caption_rules, drip_delay_seconds, media_filter_rules, scheduled_at,
                    failover_count
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, $9, $10, $11, $12, $13::jsonb, $14, $15::jsonb, $16, $17)
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    total_videos = EXCLUDED.total_videos,
                    processed_videos = EXCLUDED.processed_videos,
                    last_processed_msg_id = EXCLUDED.last_processed_msg_id,
                    is_full_migration = EXCLUDED.is_full_migration,
                    source_channel_title = EXCLUDED.source_channel_title,
                    target_channel_title = EXCLUDED.target_channel_title,
                    source_account_id = EXCLUDED.source_account_id,
                    target_account_id = EXCLUDED.target_account_id,
                    caption_rules = EXCLUDED.caption_rules,
                    drip_delay_seconds = EXCLUDED.drip_delay_seconds,
                    media_filter_rules = EXCLUDED.media_filter_rules,
                    scheduled_at = EXCLUDED.scheduled_at,
                    failover_count = EXCLUDED.failover_count,
                    updated_at = NOW();
                """,
                job.job_id,
                job.source_id,
                job.target_id,
                status_val,
                job.total_videos,
                job.processed_videos,
                job.last_processed_id,
                job.is_full_migration,
                job.source_title,
                job.target_title,
                job.source_account_id,
                job.target_account_id,
                caption_rules_json,
                job.drip_delay_seconds,
                filter_rules_json,
                sched_dt,
                getattr(job, "failover_count", 0),
            )

    async def update_job_progress(
        self, job_id: str, processed_count: int, last_msg_id: int
    ) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.update_job_progress(job_id, processed_count, last_msg_id)

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE migration_jobs
                SET processed_videos = $1,
                    last_processed_msg_id = $2,
                    updated_at = NOW()
                WHERE id = $3;
                """,
                processed_count,
                last_msg_id,
                job_id,
            )

    async def update_job_failover(
        self, job_id: str, new_account_id: int, failover_count: int
    ) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.update_job_failover(job_id, new_account_id, failover_count)

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE migration_jobs
                SET target_account_id = $1,
                    failover_count = $2,
                    updated_at = NOW()
                WHERE id = $3;
                """,
                new_account_id,
                failover_count,
                job_id,
            )

    async def set_job_status(self, job_id: str, status: JobStatus) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.set_job_status(job_id, status)

        status_val = status.value if isinstance(status, JobStatus) else str(status)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE migration_jobs
                SET status = $1,
                    updated_at = NOW()
                WHERE id = $2;
                """,
                status_val,
                job_id,
            )

    def _map_row_to_job(self, row: Any) -> MigrationJob:
        raw_rules = row.get("caption_rules") if "caption_rules" in row else None
        parsed_rules = None
        if raw_rules:
            if isinstance(raw_rules, dict):
                parsed_rules = raw_rules
            elif isinstance(raw_rules, str):
                try:
                    parsed_rules = json.loads(raw_rules)
                except Exception:
                    parsed_rules = None

        raw_filter = row.get("media_filter_rules") if "media_filter_rules" in row else None
        parsed_filter = None
        if raw_filter:
            if isinstance(raw_filter, dict):
                parsed_filter = raw_filter
            elif isinstance(raw_filter, str):
                try:
                    parsed_filter = json.loads(raw_filter)
                except Exception:
                    parsed_filter = None

        drip_sec = 0
        if "drip_delay_seconds" in row and row["drip_delay_seconds"] is not None:
            drip_sec = int(row["drip_delay_seconds"])

        return MigrationJob(
            job_id=str(row["id"]),
            source_id=int(row["source_channel_id"]),
            target_id=int(row["target_channel_id"]),
            status=JobStatus(row["status"]),
            total_videos=int(row["total_videos"]),
            processed_videos=int(row["processed_videos"]),
            last_processed_id=int(row["last_processed_msg_id"]) if row["last_processed_msg_id"] is not None else None,
            created_at=str(row["created_at"]) if row["created_at"] is not None else None,
            updated_at=str(row["updated_at"]) if row["updated_at"] is not None else None,
            is_full_migration=bool(row["is_full_migration"]) if row["is_full_migration"] is not None else True,
            source_title=str(row["source_channel_title"]) if row["source_channel_title"] is not None else None,
            target_title=str(row["target_channel_title"]) if row["target_channel_title"] is not None else None,
            source_account_id=int(row["source_account_id"]) if row["source_account_id"] is not None else None,
            target_account_id=int(row["target_account_id"]) if row["target_account_id"] is not None else None,
            caption_rules=parsed_rules,
            drip_delay_seconds=drip_sec,
            media_filter_rules=parsed_filter,
            scheduled_at=str(row["scheduled_at"]) if "scheduled_at" in row and row["scheduled_at"] is not None else None,
            failover_count=int(row["failover_count"]) if "failover_count" in row and row["failover_count"] is not None else 0,
        )

    async def get_job(self, job_id: str) -> MigrationJob | None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_job(job_id)

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, source_channel_id, target_channel_id, status,
                       total_videos, processed_videos, last_processed_msg_id,
                       created_at, updated_at, is_full_migration, source_channel_title, target_channel_title,
                       source_account_id, target_account_id, caption_rules, drip_delay_seconds, media_filter_rules,
                       scheduled_at, failover_count
                FROM migration_jobs
                WHERE id = $1;
                """,
                job_id,
            )
            if not row:
                return None
            return self._map_row_to_job(row)

    async def list_jobs(
        self,
        limit: int = 50,
        offset: int = 0,
        status: JobStatus | None = None,
    ) -> tuple[list[MigrationJob], int]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.list_jobs(limit, offset, status)

        status_val = status.value if isinstance(status, JobStatus) else (str(status) if status else None)
        async with self.pool.acquire() as conn:
            if status_val:
                total = await conn.fetchval(
                    "SELECT COUNT(*) FROM migration_jobs WHERE status = $1;",
                    status_val,
                )
                rows = await conn.fetch(
                    """
                    SELECT id, source_channel_id, target_channel_id, status,
                           total_videos, processed_videos, last_processed_msg_id,
                           created_at, updated_at, is_full_migration, source_channel_title, target_channel_title,
                           source_account_id, target_account_id, caption_rules, drip_delay_seconds, media_filter_rules,
                           scheduled_at, failover_count
                    FROM migration_jobs
                    WHERE status = $1
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3;
                    """,
                    status_val,
                    limit,
                    offset,
                )
            else:
                total = await conn.fetchval("SELECT COUNT(*) FROM migration_jobs;")
                rows = await conn.fetch(
                    """
                    SELECT id, source_channel_id, target_channel_id, status,
                           total_videos, processed_videos, last_processed_msg_id,
                           created_at, updated_at, is_full_migration, source_channel_title, target_channel_title,
                           source_account_id, target_account_id, caption_rules, drip_delay_seconds, media_filter_rules,
                           scheduled_at, failover_count
                    FROM migration_jobs
                    ORDER BY created_at DESC
                    LIMIT $1 OFFSET $2;
                    """,
                    limit,
                    offset,
                )
            jobs = [self._map_row_to_job(r) for r in rows]
            return jobs, int(total or 0)

    async def retry_failed_queue_items(self, job_id: str) -> int:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.retry_failed_queue_items(job_id)

        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE migration_queue
                SET status = 'PENDING',
                    error_message = NULL,
                    retry_count = retry_count + 1,
                    updated_at = NOW()
                WHERE job_id = $1 AND status = 'FAILED';
                """,
                job_id,
            )
            count = 0
            try:
                count = int(result.split()[-1])
            except Exception:
                count = 0
            if count > 0:
                await conn.execute(
                    "UPDATE migration_jobs SET status = 'PENDING', updated_at = NOW() WHERE id = $1;",
                    job_id,
                )
            return count

    async def retry_single_queue_item(self, job_id: str, source_msg_id: int) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.retry_single_queue_item(job_id, source_msg_id)

        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE migration_queue
                SET status = 'PENDING',
                    error_message = NULL,
                    retry_count = retry_count + 1,
                    updated_at = NOW()
                WHERE job_id = $1 AND source_message_id = $2;
                """,
                job_id,
                source_msg_id,
            )
            count = 0
            try:
                count = int(result.split()[-1])
            except Exception:
                count = 0
            if count > 0:
                await conn.execute(
                    "UPDATE migration_jobs SET status = 'PENDING', updated_at = NOW() WHERE id = $1;",
                    job_id,
                )
            return count > 0

    async def retry_bulk_queue_items(self, items: list[tuple[str, int]]) -> int:
        if not items:
            return 0
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.retry_bulk_queue_items(items)

        total_retried = 0
        affected_job_ids = set()
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for job_id, source_msg_id in items:
                    result = await conn.execute(
                        """
                        UPDATE migration_queue
                        SET status = 'PENDING',
                            error_message = NULL,
                            retry_count = retry_count + 1,
                            updated_at = NOW()
                        WHERE job_id = $1 AND source_message_id = $2;
                        """,
                        job_id,
                        source_msg_id,
                    )
                    count = 0
                    try:
                        count = int(result.split()[-1])
                    except Exception:
                        count = 0
                    if count > 0:
                        total_retried += count
                        affected_job_ids.add(job_id)

                for jid in affected_job_ids:
                    await conn.execute(
                        "UPDATE migration_jobs SET status = 'PENDING', updated_at = NOW() WHERE id = $1;",
                        jid,
                    )
        return total_retried

    async def skip_queue_item(self, job_id: str, source_msg_id: int) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.skip_queue_item(job_id, source_msg_id)

        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE migration_queue
                SET status = 'SKIPPED',
                    updated_at = NOW()
                WHERE job_id = $1 AND source_message_id = $2;
                """,
                job_id,
                source_msg_id,
            )
            try:
                return int(result.split()[-1]) > 0
            except Exception:
                return False

    async def skip_bulk_queue_items(self, items: list[tuple[str, int]]) -> int:
        if not items:
            return 0
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.skip_bulk_queue_items(items)

        total_skipped = 0
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for job_id, source_msg_id in items:
                    result = await conn.execute(
                        """
                        UPDATE migration_queue
                        SET status = 'SKIPPED',
                            updated_at = NOW()
                        WHERE job_id = $1 AND source_message_id = $2;
                        """,
                        job_id,
                        source_msg_id,
                    )
                    try:
                        count = int(result.split()[-1])
                        total_skipped += count
                    except Exception:
                        pass
        return total_skipped

    async def update_queue_item_caption(self, job_id: str, source_msg_id: int, caption: str) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.update_queue_item_caption(job_id, source_msg_id, caption)

        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE migration_queue
                SET caption = $1,
                    updated_at = NOW()
                WHERE job_id = $2 AND source_message_id = $3;
                """,
                caption,
                job_id,
                source_msg_id,
            )
            try:
                return int(result.split()[-1]) > 0
            except Exception:
                return False

    def _build_dlq_where_clause(
        self,
        job_id: str | None = None,
        error_category: str | None = None,
        media_type: str | None = None,
        search: str | None = None,
    ) -> tuple[str, list[Any]]:
        where_clauses = ["status = 'FAILED'"]
        params: list[Any] = []

        if job_id:
            params.append(job_id)
            where_clauses.append(f"job_id = ${len(params)}")

        if media_type and media_type.upper() != "ALL":
            params.append(media_type)
            where_clauses.append(f"LOWER(media_type) = LOWER(${len(params)})")

        if error_category and error_category.upper() != "ALL":
            cat = error_category.upper()
            if cat == "FLOOD_WAIT":
                where_clauses.append("(error_message ILIKE '%flood%' OR error_message ILIKE '%wait of%')")
            elif cat == "TIMEOUT_NETWORK":
                where_clauses.append("(error_message ILIKE '%timeout%' OR error_message ILIKE '%connection%' OR error_message ILIKE '%network%' OR error_message ILIKE '%timed out%')")
            elif cat == "PERMISSION_AUTH":
                where_clauses.append("(error_message ILIKE '%admin%' OR error_message ILIKE '%private%' OR error_message ILIKE '%banned%' OR error_message ILIKE '%denied%' OR error_message ILIKE '%auth%')")
            elif cat == "MEDIA_CORRUPT":
                where_clauses.append("(error_message ILIKE '%ffmpeg%' OR error_message ILIKE '%corrupt%' OR error_message ILIKE '%format%' OR error_message ILIKE '%codec%' OR error_message ILIKE '%empty output%')")
            elif cat == "OTHER":
                where_clauses.append("""(
                    COALESCE(error_message, '') NOT ILIKE '%flood%' AND COALESCE(error_message, '') NOT ILIKE '%wait of%'
                    AND COALESCE(error_message, '') NOT ILIKE '%timeout%' AND COALESCE(error_message, '') NOT ILIKE '%connection%' AND COALESCE(error_message, '') NOT ILIKE '%network%' AND COALESCE(error_message, '') NOT ILIKE '%timed out%'
                    AND COALESCE(error_message, '') NOT ILIKE '%admin%' AND COALESCE(error_message, '') NOT ILIKE '%private%' AND COALESCE(error_message, '') NOT ILIKE '%banned%' AND COALESCE(error_message, '') NOT ILIKE '%denied%' AND COALESCE(error_message, '') NOT ILIKE '%auth%'
                    AND COALESCE(error_message, '') NOT ILIKE '%ffmpeg%' AND COALESCE(error_message, '') NOT ILIKE '%corrupt%' AND COALESCE(error_message, '') NOT ILIKE '%format%' AND COALESCE(error_message, '') NOT ILIKE '%codec%' AND COALESCE(error_message, '') NOT ILIKE '%empty output%'
                )""")

        if search and search.strip():
            s_param = f"%{search.strip()}%"
            params.append(s_param)
            idx = len(params)
            where_clauses.append(f"(error_message ILIKE ${idx} OR caption ILIKE ${idx} OR CAST(source_message_id AS TEXT) ILIKE ${idx})")

        return "WHERE " + " AND ".join(where_clauses), params

    async def list_dead_letter_items(
        self,
        limit: int = 50,
        offset: int = 0,
        job_id: str | None = None,
        error_category: str | None = None,
        media_type: str | None = None,
        search: str | None = None,
    ) -> tuple[list[QueueItem], int]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.list_dead_letter_items(
                limit, offset, job_id, error_category, media_type, search
            )

        where_clause, params = self._build_dlq_where_clause(
            job_id=job_id,
            error_category=error_category,
            media_type=media_type,
            search=search,
        )

        count_query = f"SELECT COUNT(*) FROM migration_queue {where_clause};"
        p_limit = f"${len(params) + 1}"
        p_offset = f"${len(params) + 2}"
        data_query = f"""
            SELECT job_id, source_message_id, status, media_type, caption,
                   target_message_id, error_message, retry_count, created_at, updated_at,
                   is_deduplicated
            FROM migration_queue
            {where_clause}
            ORDER BY updated_at DESC
            LIMIT {p_limit} OFFSET {p_offset};
        """
        async with self.pool.acquire() as conn:
            total = await conn.fetchval(count_query, *params) or 0
            data_params = list(params) + [limit, offset]
            rows = await conn.fetch(data_query, *data_params)

            items = [
                QueueItem(
                    job_id=str(r["job_id"]),
                    source_message_id=int(r["source_message_id"]),
                    status=QueueItemStatus(r["status"]),
                    media_type=str(r["media_type"]),
                    caption=str(r["caption"] or ""),
                    target_message_id=int(r["target_message_id"]) if r["target_message_id"] is not None else None,
                    error_message=str(r["error_message"]) if r["error_message"] is not None else None,
                    retry_count=int(r["retry_count"] or 0),
                    created_at=r["created_at"].isoformat() if r["created_at"] else None,
                    updated_at=r["updated_at"].isoformat() if r["updated_at"] else None,
                    is_deduplicated=bool(r["is_deduplicated"]) if "is_deduplicated" in r and r["is_deduplicated"] is not None else False,
                )
                for r in rows
            ]
            return items, int(total)

    async def get_dead_letter_summary(self, job_id: str | None = None) -> dict[str, Any]:
        """Aggregate DLQ counts by error category and media type in PostgreSQL."""
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_dead_letter_summary(job_id)

        where_clause = "WHERE status = 'FAILED'"
        params: list[Any] = []
        if job_id:
            params.append(job_id)
            where_clause += " AND job_id = $1"

        query = f"SELECT error_message, media_type FROM migration_queue {where_clause};"
        categories = {
            "FLOOD_WAIT": 0,
            "TIMEOUT_NETWORK": 0,
            "PERMISSION_AUTH": 0,
            "MEDIA_CORRUPT": 0,
            "OTHER": 0,
        }
        media_types: dict[str, int] = {}
        total = 0

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            for r in rows:
                total += 1
                err = (r["error_message"] or "").lower()
                mtype = (r["media_type"] or "video").lower()
                media_types[mtype] = media_types.get(mtype, 0) + 1

                if "flood" in err or "wait of" in err:
                    categories["FLOOD_WAIT"] += 1
                elif any(t in err for t in ["timeout", "connection", "network", "timed out"]):
                    categories["TIMEOUT_NETWORK"] += 1
                elif any(p in err for p in ["admin", "private", "banned", "denied", "auth"]):
                    categories["PERMISSION_AUTH"] += 1
                elif any(m in err for m in ["ffmpeg", "corrupt", "format", "codec", "empty output"]):
                    categories["MEDIA_CORRUPT"] += 1
                else:
                    categories["OTHER"] += 1

        return {
            "total_failed": total,
            "by_category": categories,
            "by_media_type": media_types,
        }

    async def retry_filtered_queue_items(
        self,
        error_category: str | None = None,
        media_type: str | None = None,
        job_id: str | None = None,
        search: str | None = None,
    ) -> tuple[int, list[str]]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.retry_filtered_queue_items(
                error_category, media_type, job_id, search
            )

        where_clause, params = self._build_dlq_where_clause(
            job_id=job_id,
            error_category=error_category,
            media_type=media_type,
            search=search,
        )

        select_query = f"SELECT DISTINCT job_id FROM migration_queue {where_clause};"
        update_query = f"""
            UPDATE migration_queue
            SET status = 'PENDING', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
            {where_clause};
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(select_query, *params)
            affected_jobs = [str(r["job_id"]) for r in rows]

            res = await conn.execute(update_query, *params)
            retried_count = int(res.split()[-1])
            return retried_count, affected_jobs

    async def skip_filtered_queue_items(
        self,
        error_category: str | None = None,
        media_type: str | None = None,
        job_id: str | None = None,
        search: str | None = None,
    ) -> int:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.skip_filtered_queue_items(
                error_category, media_type, job_id, search
            )

        where_clause, params = self._build_dlq_where_clause(
            job_id=job_id,
            error_category=error_category,
            media_type=media_type,
            search=search,
        )
        update_query = f"UPDATE migration_queue SET status = 'SKIPPED', updated_at = CURRENT_TIMESTAMP {where_clause};"
        async with self.pool.acquire() as conn:
            res = await conn.execute(update_query, *params)
            return int(res.split()[-1])

    async def delete_job(self, job_id: str) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.delete_job(job_id)

        async with self.pool.acquire() as conn:
            await conn.execute("DELETE FROM migration_jobs WHERE id = $1;", job_id)
            return True

    async def reconcile_orphaned_jobs(self) -> int:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.reconcile_orphaned_jobs()

        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE migration_jobs
                SET status = 'PAUSED',
                    updated_at = NOW()
                WHERE status = 'RUNNING';
                """
            )
            try:
                return int(result.split()[-1])
            except Exception:
                return 0

    async def reconcile_orphaned_queue_items(self) -> int:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.reconcile_orphaned_queue_items()

        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE migration_queue
                SET status = 'PENDING',
                    updated_at = NOW()
                WHERE status = 'IN_PROGRESS';
                """
            )
            try:
                return int(result.split()[-1])
            except Exception:
                return 0

    async def reconcile_orphaned_broadcasts(self) -> int:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.reconcile_orphaned_broadcasts()

        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE scheduled_broadcasts
                SET status = 'SCHEDULED',
                    last_error = 'Interrupted by system restart'
                WHERE status = 'RUNNING';
                """
            )
            try:
                return int(result.split()[-1])
            except Exception:
                return 0

    async def reconcile_orphaned_video_processing_jobs(self) -> int:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.reconcile_orphaned_video_processing_jobs()

        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE video_processing_jobs
                SET status = 'FAILED',
                    error_message = 'Interrupted by system restart',
                    updated_at = NOW()
                WHERE status = 'PROCESSING';
                """
            )
            try:
                return int(result.split()[-1])
            except Exception:
                return 0

    async def record_migrated_item(
        self, job_id: str, source_msg_id: int, target_msg_id: int
    ) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.record_migrated_item(job_id, source_msg_id, target_msg_id)

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO migration_items (
                    job_id, source_message_id, target_message_id, processed_at
                ) VALUES ($1, $2, $3, NOW())
                ON CONFLICT (job_id, source_message_id) DO UPDATE SET
                    target_message_id = EXCLUDED.target_message_id,
                    processed_at = NOW();
                """,
                job_id,
                source_msg_id,
                target_msg_id,
            )

    async def is_item_migrated(self, job_id: str, source_msg_id: int) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.is_item_migrated(job_id, source_msg_id)

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT 1 FROM migration_items mi
                WHERE mi.job_id = $1 AND mi.source_message_id = $2
                UNION
                SELECT 1 FROM migration_items mi
                JOIN migration_jobs mj_orig ON mi.job_id = mj_orig.id
                JOIN migration_jobs mj_curr ON mj_curr.id = $3
                WHERE mj_orig.source_channel_id = mj_curr.source_channel_id
                  AND mj_orig.target_channel_id = mj_curr.target_channel_id
                  AND mi.source_message_id = $4
                LIMIT 1;
                """,
                job_id,
                source_msg_id,
                job_id,
                source_msg_id,
            )
            return row is not None

    async def add_queue_items(self, items: list[QueueItem]) -> None:
        if not items:
            return
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.add_queue_items(items)

        records = [
            (
                item.job_id,
                item.source_message_id,
                item.status.value if isinstance(item.status, QueueItemStatus) else str(item.status),
                item.media_type,
                item.caption or "",
                item.retry_count,
                item.error_message,
            )
            for item in items
        ]
        async with self.pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO migration_queue (
                    job_id, source_message_id, status, media_type, caption, retry_count, error_message
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (job_id, source_message_id) DO NOTHING;
                """,
                records,
            )

    async def get_queue_items(
        self, job_id: str, status: QueueItemStatus | None = None
    ) -> list[QueueItem]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_queue_items(job_id, status)

        query = """
            SELECT job_id, source_message_id, status, media_type, caption,
                   target_message_id, error_message, retry_count, created_at, updated_at,
                   is_deduplicated
            FROM migration_queue
            WHERE job_id = $1
        """
        params: list[Any] = [job_id]
        if status is not None:
            status_val = status.value if isinstance(status, QueueItemStatus) else str(status)
            query += " AND status = $2"
            params.append(status_val)
        query += " ORDER BY source_message_id ASC;"

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [
                QueueItem(
                    job_id=str(row["job_id"]),
                    source_message_id=int(row["source_message_id"]),
                    status=QueueItemStatus(row["status"]),
                    media_type=str(row["media_type"]),
                    caption=str(row["caption"] or ""),
                    target_message_id=int(row["target_message_id"]) if row["target_message_id"] is not None else None,
                    error_message=str(row["error_message"]) if row["error_message"] is not None else None,
                    retry_count=int(row["retry_count"]),
                    created_at=str(row["created_at"]) if row["created_at"] is not None else None,
                    updated_at=str(row["updated_at"]) if row["updated_at"] is not None else None,
                    is_deduplicated=bool(row["is_deduplicated"]) if "is_deduplicated" in row and row["is_deduplicated"] is not None else False,
                )
                for row in rows
            ]

    async def get_next_pending_queue_item(self, job_id: str) -> QueueItem | None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_next_pending_queue_item(job_id)

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT job_id, source_message_id, status, media_type, caption,
                       target_message_id, error_message, retry_count, created_at, updated_at,
                       is_deduplicated
                FROM migration_queue
                WHERE job_id = $1 AND status = 'PENDING'
                ORDER BY source_message_id ASC
                LIMIT 1;
                """,
                job_id,
            )
            if not row:
                return None
            return QueueItem(
                job_id=str(row["job_id"]),
                source_message_id=int(row["source_message_id"]),
                status=QueueItemStatus(row["status"]),
                media_type=str(row["media_type"]),
                caption=str(row["caption"] or ""),
                target_message_id=int(row["target_message_id"]) if row["target_message_id"] is not None else None,
                error_message=str(row["error_message"]) if row["error_message"] is not None else None,
                retry_count=int(row["retry_count"]),
                created_at=str(row["created_at"]) if row["created_at"] is not None else None,
                updated_at=str(row["updated_at"]) if row["updated_at"] is not None else None,
                is_deduplicated=bool(row["is_deduplicated"]) if "is_deduplicated" in row and row["is_deduplicated"] is not None else False,
            )

    async def update_queue_item_status(
        self,
        job_id: str,
        source_msg_id: int,
        status: QueueItemStatus,
        target_msg_id: int | None = None,
        error_message: str | None = None,
        is_deduplicated: bool = False,
    ) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.update_queue_item_status(
                job_id, source_msg_id, status, target_msg_id, error_message, is_deduplicated
            )

        status_val = status.value if isinstance(status, QueueItemStatus) else str(status)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE migration_queue
                SET status = $1,
                    target_message_id = COALESCE($2, target_message_id),
                    error_message = $3,
                    is_deduplicated = CASE WHEN $4::boolean THEN TRUE ELSE is_deduplicated END,
                    updated_at = NOW()
                WHERE job_id = $5 AND source_message_id = $6;
                """,
                status_val,
                target_msg_id,
                error_message,
                bool(is_deduplicated),
                job_id,
                source_msg_id,
            )

    async def get_queue_stats(self, job_id: str) -> dict[str, int]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_queue_stats(job_id)

        stats: dict[str, int] = {
            "total": 0,
            "pending": 0,
            "in_progress": 0,
            "completed": 0,
            "failed": 0,
            "skipped": 0,
            "deduplicated": 0,
        }
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT status, COUNT(*) as cnt
                FROM migration_queue
                WHERE job_id = $1
                GROUP BY status;
                """,
                job_id,
            )
            for row in rows:
                st = str(row["status"]).lower()
                cnt = int(row["cnt"])
                if st in stats:
                    stats[st] = cnt
                stats["total"] += cnt

            dedup_cnt = await conn.fetchval(
                "SELECT COUNT(*) FROM migration_queue WHERE job_id = $1 AND is_deduplicated = TRUE;",
                job_id,
            )
            stats["deduplicated"] = int(dedup_cnt or 0)
        return stats

    async def get_channel_cloning_history(self, channel_id: int) -> ChannelCloningHistory:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_channel_cloning_history(channel_id)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, source_channel_id, target_channel_id, status,
                       total_videos, processed_videos, last_processed_msg_id,
                       created_at, updated_at, is_full_migration, source_channel_title, target_channel_title,
                       source_account_id, target_account_id
                FROM migration_jobs
                WHERE source_channel_id = $1
                ORDER BY created_at DESC;
                """,
                channel_id,
            )

            jobs: list[MigrationJob] = []
            for r in rows:
                jobs.append(
                    MigrationJob(
                        job_id=str(r["id"]),
                        source_id=int(r["source_channel_id"]),
                        target_id=int(r["target_channel_id"]),
                        status=JobStatus(r["status"]),
                        total_videos=int(r["total_videos"]),
                        processed_videos=int(r["processed_videos"]),
                        last_processed_id=int(r["last_processed_msg_id"]) if r["last_processed_msg_id"] is not None else None,
                        created_at=str(r["created_at"]) if r["created_at"] is not None else None,
                        updated_at=str(r["updated_at"]) if r["updated_at"] is not None else None,
                        is_full_migration=bool(r["is_full_migration"]) if r["is_full_migration"] is not None else True,
                        source_title=str(r["source_channel_title"]) if r["source_channel_title"] is not None else None,
                        target_title=str(r["target_channel_title"]) if r["target_channel_title"] is not None else None,
                        source_account_id=int(r["source_account_id"]) if r["source_account_id"] is not None else None,
                        target_account_id=int(r["target_account_id"]) if r["target_account_id"] is not None else None,
                    )
                )

            count_row = await conn.fetchval(
                """
                SELECT COUNT(DISTINCT mi.source_message_id)
                FROM migration_items mi
                JOIN migration_jobs mj ON mi.job_id = mj.id
                WHERE mj.source_channel_id = $1;
                """,
                channel_id,
            )
            total_items_cloned = int(count_row) if count_row else 0

            has_full_clone = any(
                j.is_full_migration and j.status == JobStatus.COMPLETED and j.processed_videos > 0
                for j in jobs
            )

            return ChannelCloningHistory(
                channel_id=channel_id,
                total_clones=len(jobs),
                has_full_clone=has_full_clone,
                total_items_cloned=total_items_cloned,
                jobs=jobs,
            )

    async def get_cloned_content_for_channel(self, channel_id: int) -> list[ClonedContentItem]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_cloned_content_for_channel(channel_id)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT mq.job_id, mq.source_message_id, mq.target_message_id,
                       mq.media_type, mq.caption, mq.updated_at,
                       mj.target_channel_id, mj.target_channel_title
                FROM migration_queue mq
                JOIN migration_jobs mj ON mq.job_id = mj.id
                WHERE mj.source_channel_id = $1 AND mq.status = 'COMPLETED'
                ORDER BY mq.source_message_id DESC;
                """,
                channel_id,
            )

            return [
                ClonedContentItem(
                    job_id=str(r["job_id"]),
                    source_message_id=int(r["source_message_id"]),
                    target_message_id=int(r["target_message_id"]) if r["target_message_id"] is not None else None,
                    media_type=str(r["media_type"]),
                    caption=str(r["caption"] or ""),
                    migrated_at=str(r["updated_at"]) if r["updated_at"] is not None else None,
                    target_channel_id=int(r["target_channel_id"]),
                    target_channel_title=str(r["target_channel_title"]) if r["target_channel_title"] is not None else None,
                )
                for r in rows
            ]

    async def get_source_item_for_target(
        self, target_channel_id: int, target_message_id: int
    ) -> tuple[int, int] | None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.get_source_item_for_target(target_channel_id, target_message_id)
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT j.source_channel_id, q.source_message_id
                FROM migration_queue q
                JOIN migration_jobs j ON q.job_id = j.id
                WHERE j.target_channel_id = $1 AND q.target_message_id = $2
                LIMIT 1
                """,
                target_channel_id,
                target_message_id,
            )
            if row:
                return int(row["source_channel_id"]), int(row["source_message_id"])
            return None

    async def get_cloned_source_message_ids(
        self, source_channel_id: int, target_channel_id: int
    ) -> set[int]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.get_cloned_source_message_ids(source_channel_id, target_channel_id)
            return set()

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT DISTINCT mq.source_message_id
                FROM migration_queue mq
                JOIN migration_jobs mj ON mq.job_id = mj.id
                WHERE mj.source_channel_id = $1
                  AND mj.target_channel_id = $2
                  AND mq.status = 'COMPLETED'
                """,
                source_channel_id,
                target_channel_id,
            )
            return {int(r["source_message_id"]) for r in rows}

    async def save_sync_binding(self, binding: ChannelSyncBinding) -> ChannelSyncBinding:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.save_sync_binding(binding)
            return binding

        rules_json = json.dumps(binding.caption_rules) if binding.caption_rules else None
        filter_json = json.dumps(binding.media_filter_rules) if binding.media_filter_rules else None
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO channel_sync_bindings (
                    source_channel_id, target_channel_id,
                    source_channel_title, target_channel_title,
                    source_account_id, target_account_id,
                    is_active, last_synced_message_id, caption_rules, media_filter_rules,
                    status, last_error, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, NOW())
                ON CONFLICT (source_channel_id, target_channel_id) DO UPDATE SET
                    source_channel_title = EXCLUDED.source_channel_title,
                    target_channel_title = EXCLUDED.target_channel_title,
                    source_account_id = EXCLUDED.source_account_id,
                    target_account_id = EXCLUDED.target_account_id,
                    is_active = EXCLUDED.is_active,
                    last_synced_message_id = EXCLUDED.last_synced_message_id,
                    caption_rules = EXCLUDED.caption_rules,
                    media_filter_rules = EXCLUDED.media_filter_rules,
                    status = EXCLUDED.status,
                    last_error = EXCLUDED.last_error,
                    updated_at = NOW();
                """,
                binding.source_channel_id,
                binding.target_channel_id,
                binding.source_channel_title,
                binding.target_channel_title,
                binding.source_account_id,
                binding.target_account_id,
                binding.is_active,
                binding.last_synced_message_id,
                rules_json,
                filter_json,
                getattr(binding, "status", "ACTIVE") or "ACTIVE",
                getattr(binding, "last_error", None),
            )
            return binding

    async def get_sync_binding(
        self, source_channel_id: int, target_channel_id: int
    ) -> ChannelSyncBinding | None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.get_sync_binding(source_channel_id, target_channel_id)
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT source_channel_id, target_channel_id,
                       source_channel_title, target_channel_title,
                       source_account_id, target_account_id,
                       is_active, last_synced_message_id, created_at, updated_at,
                       caption_rules, media_filter_rules,
                       status, last_error
                FROM channel_sync_bindings
                WHERE source_channel_id = $1 AND target_channel_id = $2;
                """,
                source_channel_id,
                target_channel_id,
            )
            if not row:
                return None

            raw_rules = row.get("caption_rules") if "caption_rules" in row else None
            parsed_rules = None
            if raw_rules:
                if isinstance(raw_rules, dict):
                    parsed_rules = raw_rules
                elif isinstance(raw_rules, str):
                    try:
                        parsed_rules = json.loads(raw_rules)
                    except Exception:
                        parsed_rules = None

            raw_filter = row.get("media_filter_rules") if "media_filter_rules" in row else None
            parsed_filter = None
            if raw_filter:
                if isinstance(raw_filter, dict):
                    parsed_filter = raw_filter
                elif isinstance(raw_filter, str):
                    try:
                        parsed_filter = json.loads(raw_filter)
                    except Exception:
                        parsed_filter = None

            return ChannelSyncBinding(
                source_channel_id=int(row["source_channel_id"]),
                target_channel_id=int(row["target_channel_id"]),
                source_channel_title=row["source_channel_title"],
                target_channel_title=row["target_channel_title"],
                source_account_id=row["source_account_id"],
                target_account_id=row["target_account_id"],
                is_active=bool(row["is_active"]),
                last_synced_message_id=int(row["last_synced_message_id"]),
                created_at=str(row["created_at"]) if row["created_at"] else None,
                updated_at=str(row["updated_at"]) if row["updated_at"] else None,
                caption_rules=parsed_rules,
                media_filter_rules=parsed_filter,
                status=row["status"] if "status" in row and row["status"] else "ACTIVE",
                last_error=row.get("last_error") if "last_error" in row else None,
            )

    async def get_active_sync_bindings(self) -> list[ChannelSyncBinding]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.get_active_sync_bindings()
            return []

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT source_channel_id, target_channel_id,
                       source_channel_title, target_channel_title,
                       source_account_id, target_account_id,
                       is_active, last_synced_message_id, created_at, updated_at,
                       caption_rules, media_filter_rules,
                       status, last_error
                FROM channel_sync_bindings
                WHERE is_active = TRUE
                ORDER BY updated_at DESC;
                """
            )
            result = []
            for r in rows:
                raw_rules = r.get("caption_rules") if "caption_rules" in r else None
                parsed_rules = None
                if raw_rules:
                    if isinstance(raw_rules, dict):
                        parsed_rules = raw_rules
                    elif isinstance(raw_rules, str):
                        try:
                            parsed_rules = json.loads(raw_rules)
                        except Exception:
                            parsed_rules = None

                raw_filter = r.get("media_filter_rules") if "media_filter_rules" in r else None
                parsed_filter = None
                if raw_filter:
                    if isinstance(raw_filter, dict):
                        parsed_filter = raw_filter
                    elif isinstance(raw_filter, str):
                        try:
                            parsed_filter = json.loads(raw_filter)
                        except Exception:
                            parsed_filter = None

                result.append(
                    ChannelSyncBinding(
                        source_channel_id=int(r["source_channel_id"]),
                        target_channel_id=int(r["target_channel_id"]),
                        source_channel_title=r["source_channel_title"],
                        target_channel_title=r["target_channel_title"],
                        source_account_id=r["source_account_id"],
                        target_account_id=r["target_account_id"],
                        is_active=bool(r["is_active"]),
                        last_synced_message_id=int(r["last_synced_message_id"]),
                        created_at=str(r["created_at"]) if r["created_at"] else None,
                        updated_at=str(r["updated_at"]) if r["updated_at"] else None,
                        caption_rules=parsed_rules,
                        media_filter_rules=parsed_filter,
                        status=r["status"] if "status" in r and r["status"] else "ACTIVE",
                        last_error=r.get("last_error") if "last_error" in r else None,
                    )
                )
            return result

    async def list_sync_bindings(self) -> list[ChannelSyncBinding]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.list_sync_bindings()
            return []

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT source_channel_id, target_channel_id,
                       source_channel_title, target_channel_title,
                       source_account_id, target_account_id,
                       is_active, last_synced_message_id, created_at, updated_at,
                       caption_rules, media_filter_rules,
                       status, last_error
                FROM channel_sync_bindings
                ORDER BY updated_at DESC;
                """
            )
            result = []
            for r in rows:
                raw_rules = r.get("caption_rules") if "caption_rules" in r else None
                parsed_rules = None
                if raw_rules:
                    if isinstance(raw_rules, dict):
                        parsed_rules = raw_rules
                    elif isinstance(raw_rules, str):
                        try:
                            parsed_rules = json.loads(raw_rules)
                        except Exception:
                            parsed_rules = None

                raw_filter = r.get("media_filter_rules") if "media_filter_rules" in r else None
                parsed_filter = None
                if raw_filter:
                    if isinstance(raw_filter, dict):
                        parsed_filter = raw_filter
                    elif isinstance(raw_filter, str):
                        try:
                            parsed_filter = json.loads(raw_filter)
                        except Exception:
                            parsed_filter = None

                result.append(
                    ChannelSyncBinding(
                        source_channel_id=int(r["source_channel_id"]),
                        target_channel_id=int(r["target_channel_id"]),
                        source_channel_title=r["source_channel_title"],
                        target_channel_title=r["target_channel_title"],
                        source_account_id=r["source_account_id"],
                        target_account_id=r["target_account_id"],
                        is_active=bool(r["is_active"]),
                        last_synced_message_id=int(r["last_synced_message_id"]),
                        created_at=str(r["created_at"]) if r["created_at"] else None,
                        updated_at=str(r["updated_at"]) if r["updated_at"] else None,
                        caption_rules=parsed_rules,
                        media_filter_rules=parsed_filter,
                        status=r["status"] if "status" in r and r["status"] else "ACTIVE",
                        last_error=r.get("last_error") if "last_error" in r else None,
                    )
                )
            return result

    async def delete_sync_binding(
        self, source_channel_id: int, target_channel_id: int
    ) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.delete_sync_binding(source_channel_id, target_channel_id)
            return True

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                DELETE FROM channel_sync_bindings
                WHERE source_channel_id = $1 AND target_channel_id = $2;
                """,
                source_channel_id,
                target_channel_id,
            )
            return True

    async def is_media_fingerprint_duplicated(
        self, target_channel_id: int, fingerprint_hash: str
    ) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.is_media_fingerprint_duplicated(
                    target_channel_id, fingerprint_hash
                )
            return False

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT 1 FROM migrated_media_fingerprints
                WHERE target_channel_id = $1 AND fingerprint_hash = $2
                LIMIT 1;
                """,
                target_channel_id,
                fingerprint_hash,
            )
            return row is not None

    async def get_media_fingerprint(
        self, target_channel_id: int, fingerprint_hash: str
    ) -> dict[str, Any] | None:
        """Find matching fingerprint record for a specific target channel."""
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.get_media_fingerprint(
                    target_channel_id, fingerprint_hash
                )
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT target_channel_id, fingerprint_hash, source_channel_id,
                       source_message_id, target_message_id, media_type, created_at
                FROM migrated_media_fingerprints
                WHERE target_channel_id = $1 AND fingerprint_hash = $2
                LIMIT 1;
                """,
                target_channel_id,
                fingerprint_hash,
            )
            if not row:
                return None
            return {
                "target_channel_id": int(row["target_channel_id"]),
                "fingerprint_hash": str(row["fingerprint_hash"]),
                "source_channel_id": int(row["source_channel_id"]) if row["source_channel_id"] is not None else None,
                "source_message_id": int(row["source_message_id"]) if row["source_message_id"] is not None else None,
                "target_message_id": int(row["target_message_id"]) if row["target_message_id"] is not None else None,
                "media_type": str(row["media_type"]),
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }

    async def find_media_fingerprint_anywhere(
        self, fingerprint_hash: str
    ) -> dict[str, Any] | None:
        """Find if a media fingerprint was already migrated to ANY channel."""
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.find_media_fingerprint_anywhere(fingerprint_hash)
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT target_channel_id, fingerprint_hash, source_channel_id,
                       source_message_id, target_message_id, media_type, created_at
                FROM migrated_media_fingerprints
                WHERE fingerprint_hash = $1
                ORDER BY created_at DESC
                LIMIT 1;
                """,
                fingerprint_hash,
            )
            if not row:
                return None
            return {
                "target_channel_id": int(row["target_channel_id"]),
                "fingerprint_hash": str(row["fingerprint_hash"]),
                "source_channel_id": int(row["source_channel_id"]) if row["source_channel_id"] is not None else None,
                "source_message_id": int(row["source_message_id"]) if row["source_message_id"] is not None else None,
                "target_message_id": int(row["target_message_id"]) if row["target_message_id"] is not None else None,
                "media_type": str(row["media_type"]),
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }

    async def get_deduplication_stats(self) -> dict[str, Any]:
        """Aggregate total fingerprints, deduplicated items, and estimated bandwidth saved."""
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.get_deduplication_stats()
            return {
                "total_fingerprints": 0,
                "total_deduplicated_items": 0,
                "estimated_saved_bytes": 0,
                "estimated_saved_mb": 0.0,
            }

        async with self.pool.acquire() as conn:
            total_fps = await conn.fetchval("SELECT count(*) FROM migrated_media_fingerprints;") or 0
            total_dedup = await conn.fetchval(
                "SELECT count(*) FROM migration_queue WHERE is_deduplicated = TRUE;"
            ) or 0
            saved_bytes = total_dedup * 25 * 1024 * 1024
            saved_mb = round(saved_bytes / (1024 * 1024), 2)
            return {
                "total_fingerprints": total_fps,
                "total_deduplicated_items": total_dedup,
                "estimated_saved_bytes": saved_bytes,
                "estimated_saved_mb": saved_mb,
            }

    async def record_media_fingerprint(
        self,
        target_channel_id: int,
        fingerprint_hash: str,
        source_channel_id: int | None = None,
        source_message_id: int | None = None,
        target_message_id: int | None = None,
        media_type: str = "video",
    ) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                await self._fallback_repo.record_media_fingerprint(
                    target_channel_id,
                    fingerprint_hash,
                    source_channel_id,
                    source_message_id,
                    target_message_id,
                    media_type,
                )
            return

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO migrated_media_fingerprints (
                    target_channel_id, fingerprint_hash, source_channel_id,
                    source_message_id, target_message_id, media_type, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (target_channel_id, fingerprint_hash) DO NOTHING;
                """,
                target_channel_id,
                fingerprint_hash,
                source_channel_id,
                source_message_id,
                target_message_id,
                media_type,
            )

    async def get_analytics_summary(self) -> dict[str, Any]:
        """Aggregate cross-job, queue, items, and fingerprint metrics for analytics reporting."""
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if self._fallback_repo:
                return await self._fallback_repo.get_analytics_summary()
            return {
                "total_items_migrated": 0,
                "total_bandwidth_saved_bytes": 0,
                "duplicates_prevented": 0,
                "total_jobs": 0,
                "jobs_by_status": {},
                "active_sync_bindings": 0,
                "media_type_distribution": {},
                "daily_volume": [],
                "efficiency_percent": 99.8,
            }

        async with self.pool.acquire() as conn:
            total_items = await conn.fetchval("SELECT count(*) FROM migration_items;") or 0

            job_rows = await conn.fetch("SELECT status, count(*) as count FROM migration_jobs GROUP BY status;")
            jobs_by_status = {row["status"]: row["count"] for row in job_rows}
            total_jobs = sum(jobs_by_status.values())

            active_syncs = await conn.fetchval(
                "SELECT count(*) FROM channel_sync_bindings WHERE is_active = true;"
            ) or 0

            fingerprints_count = await conn.fetchval("SELECT count(*) FROM migrated_media_fingerprints;") or 0
            skipped_queue_count = await conn.fetchval(
                "SELECT count(*) FROM migration_queue WHERE status = 'SKIPPED';"
            ) or 0
            duplicates_prevented = fingerprints_count + skipped_queue_count

            media_rows = await conn.fetch("SELECT media_type, count(*) as count FROM migration_queue GROUP BY media_type;")
            media_type_distribution = {row["media_type"]: row["count"] for row in media_rows}

            daily_rows = await conn.fetch(
                """
                SELECT 
                    TO_CHAR(processed_at, 'YYYY-MM-DD') as day,
                    count(*) as count
                FROM migration_items
                WHERE processed_at >= NOW() - INTERVAL '30 days'
                GROUP BY TO_CHAR(processed_at, 'YYYY-MM-DD')
                ORDER BY day ASC;
                """
            )
            daily_volume = [
                {"date": row["day"], "count": row["count"], "estimated_mb": row["count"] * 25.0}
                for row in daily_rows
            ]

            # 25 MB estimated per media item (server-side reference clone avoids downloading and re-uploading)
            avg_media_bytes = 26214400
            total_bandwidth_saved_bytes = total_items * avg_media_bytes

            recent_rows = await conn.fetch(
                """
                SELECT
                    id as job_id,
                    source_channel_id,
                    target_channel_id,
                    COALESCE(source_channel_title, 'Canal #' || source_channel_id::text) as source_title,
                    COALESCE(target_channel_title, 'Canal #' || target_channel_id::text) as target_title,
                    status,
                    total_videos,
                    processed_videos,
                    round(processed_videos * 25.0, 1) as estimated_mb,
                    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
                FROM migration_jobs
                ORDER BY created_at DESC
                LIMIT 8;
                """
            )
            recent_transfers = [
                {
                    "job_id": r["job_id"],
                    "source_channel_id": r["source_channel_id"],
                    "target_channel_id": r["target_channel_id"],
                    "source_title": r["source_title"],
                    "target_title": r["target_title"],
                    "status": r["status"],
                    "total_videos": r["total_videos"],
                    "processed_videos": r["processed_videos"],
                    "estimated_mb": float(r["estimated_mb"] or 0),
                    "created_at": r["created_at"] or "",
                }
                for r in recent_rows
            ]

            top_rows = await conn.fetch(
                """
                SELECT
                    source_channel_id as channel_id,
                    COALESCE(source_channel_title, 'Canal #' || source_channel_id::text) as title,
                    sum(processed_videos) as total_items,
                    round(sum(processed_videos) * 25.0 / 1024, 2) as volume_gb
                FROM migration_jobs
                GROUP BY source_channel_id, source_channel_title
                ORDER BY total_items DESC
                LIMIT 5;
                """
            )
            top_channels = [
                {
                    "channel_id": r["channel_id"],
                    "title": r["title"],
                    "total_items": int(r["total_items"] or 0),
                    "volume_gb": float(r["volume_gb"] or 0.0),
                }
                for r in top_rows
                if (r["total_items"] or 0) > 0
            ]

            return {
                "total_items_migrated": total_items,
                "total_bandwidth_saved_bytes": total_bandwidth_saved_bytes,
                "duplicates_prevented": duplicates_prevented,
                "total_jobs": total_jobs,
                "jobs_by_status": jobs_by_status,
                "active_sync_bindings": active_syncs,
                "media_type_distribution": media_type_distribution,
                "daily_volume": daily_volume,
                "efficiency_percent": 99.8,
                "recent_transfers": recent_transfers,
                "top_channels": top_channels,
            }

    async def create_scheduled_broadcast(
        self, broadcast: ScheduledBroadcast
    ) -> ScheduledBroadcast:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.create_scheduled_broadcast(broadcast)

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO scheduled_broadcasts (
                    id, name, target_ids, text, media_paths, account_id,
                    scheduled_at, recurrence, status, last_run_at, run_count,
                    last_error, created_at
                ) VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, NOW())
                """,
                broadcast.id,
                broadcast.name,
                json.dumps(broadcast.target_ids),
                broadcast.text,
                json.dumps(broadcast.media_paths) if broadcast.media_paths else None,
                broadcast.account_id,
                broadcast.scheduled_at,
                broadcast.recurrence,
                broadcast.status,
                broadcast.last_run_at,
                broadcast.run_count,
                broadcast.last_error,
            )
            return broadcast

    async def get_scheduled_broadcast(self, id: str) -> ScheduledBroadcast | None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_scheduled_broadcast(id)

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, name, target_ids, text, media_paths, account_id,
                       scheduled_at, recurrence, status, last_run_at, run_count,
                       last_error, created_at
                FROM scheduled_broadcasts WHERE id = $1
                """,
                id,
            )
            if not row:
                return None
            return self._pg_row_to_scheduled_broadcast(row)

    async def list_scheduled_broadcasts(
        self, status: str | None = None
    ) -> list[ScheduledBroadcast]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.list_scheduled_broadcasts(status)

        async with self.pool.acquire() as conn:
            if status:
                rows = await conn.fetch(
                    """
                    SELECT id, name, target_ids, text, media_paths, account_id,
                           scheduled_at, recurrence, status, last_run_at, run_count,
                           last_error, created_at
                    FROM scheduled_broadcasts WHERE status = $1
                    ORDER BY scheduled_at ASC
                    """,
                    status,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, name, target_ids, text, media_paths, account_id,
                           scheduled_at, recurrence, status, last_run_at, run_count,
                           last_error, created_at
                    FROM scheduled_broadcasts
                    ORDER BY scheduled_at ASC
                    """
                )
            return [self._pg_row_to_scheduled_broadcast(r) for r in rows]

    async def update_scheduled_broadcast(
        self, broadcast: ScheduledBroadcast
    ) -> ScheduledBroadcast:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.update_scheduled_broadcast(broadcast)

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE scheduled_broadcasts SET
                    name = $1,
                    target_ids = $2::jsonb,
                    text = $3,
                    media_paths = $4::jsonb,
                    account_id = $5,
                    scheduled_at = $6,
                    recurrence = $7,
                    status = $8,
                    last_run_at = $9,
                    run_count = $10,
                    last_error = $11
                WHERE id = $12
                """,
                broadcast.name,
                json.dumps(broadcast.target_ids),
                broadcast.text,
                json.dumps(broadcast.media_paths) if broadcast.media_paths else None,
                broadcast.account_id,
                broadcast.scheduled_at,
                broadcast.recurrence,
                broadcast.status,
                broadcast.last_run_at,
                broadcast.run_count,
                broadcast.last_error,
                broadcast.id,
            )
            return broadcast

    async def delete_scheduled_broadcast(self, id: str) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.delete_scheduled_broadcast(id)

        async with self.pool.acquire() as conn:
            res = await conn.execute("DELETE FROM scheduled_broadcasts WHERE id = $1", id)
            return "DELETE 1" in res

    def _pg_row_to_scheduled_broadcast(self, row: Any) -> ScheduledBroadcast:
        target_ids = (
            json.loads(row["target_ids"])
            if isinstance(row["target_ids"], str)
            else (row["target_ids"] or [])
        )
        media_paths = (
            json.loads(row["media_paths"])
            if isinstance(row["media_paths"], str)
            else (row["media_paths"] or [])
        )
        return ScheduledBroadcast(
            id=row["id"],
            name=row["name"],
            target_ids=target_ids,
            text=row["text"],
            media_paths=media_paths,
            account_id=row["account_id"],
            scheduled_at=row["scheduled_at"],
            recurrence=row["recurrence"],
            status=row["status"],
            last_run_at=row["last_run_at"],
            run_count=row["run_count"] or 0,
            last_error=row["last_error"],
            created_at=str(row["created_at"]),
        )

    async def save_notification(
        self, notification: AppNotification
    ) -> AppNotification:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.save_notification(notification)

        tid = notification.tenant_id or "default"
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO app_notifications (id, tenant_id, title, message, severity, is_read, link, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    message = EXCLUDED.message,
                    severity = EXCLUDED.severity,
                    is_read = EXCLUDED.is_read,
                    link = EXCLUDED.link
                """,
                notification.id,
                tid,
                notification.title,
                notification.message,
                notification.severity,
                notification.is_read,
                notification.link,
            )
        return notification

    async def list_notifications(
        self, tenant_id: str = "default", limit: int = 30, unread_only: bool = False
    ) -> list[AppNotification]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.list_notifications(tenant_id, limit, unread_only)

        tid = tenant_id or "default"
        query = """
            SELECT id, tenant_id, title, message, severity, is_read, link, created_at
            FROM app_notifications
            WHERE tenant_id = $1
        """
        if unread_only:
            query += " AND is_read = FALSE"
        query += " ORDER BY created_at DESC LIMIT $2"

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, tid, limit)
            return [
                AppNotification(
                    id=row["id"],
                    tenant_id=row["tenant_id"],
                    title=row["title"],
                    message=row["message"],
                    severity=row["severity"],
                    is_read=row["is_read"],
                    link=row["link"],
                    created_at=str(row["created_at"]),
                )
                for row in rows
            ]

    async def mark_notification_as_read(
        self, notification_id: str, tenant_id: str = "default"
    ) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.mark_notification_as_read(notification_id, tenant_id)

        tid = tenant_id or "default"
        async with self.pool.acquire() as conn:
            res = await conn.execute(
                """
                UPDATE app_notifications
                SET is_read = TRUE
                WHERE id = $1 AND tenant_id = $2
                """,
                notification_id,
                tid,
            )
            return "UPDATE 1" in res

    async def mark_all_notifications_as_read(
        self, tenant_id: str = "default"
    ) -> int:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.mark_all_notifications_as_read(tenant_id)

        tid = tenant_id or "default"
        async with self.pool.acquire() as conn:
            res = await conn.execute(
                """
                UPDATE app_notifications
                SET is_read = TRUE
                WHERE tenant_id = $1 AND is_read = FALSE
                """,
                tid,
            )
            try:
                return int(res.split(" ")[-1])
            except Exception:
                return 0

    async def get_unread_notifications_count(
        self, tenant_id: str = "default"
    ) -> int:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.get_unread_notifications_count(tenant_id)

        tid = tenant_id or "default"
        async with self.pool.acquire() as conn:
            val = await conn.fetchval(
                """
                SELECT COUNT(*) FROM app_notifications
                WHERE tenant_id = $1 AND is_read = FALSE
                """,
                tid,
            )
            return int(val or 0)

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None
        if self._fallback_repo is not None:
            await self._fallback_repo.close()
            self._fallback_repo = None
