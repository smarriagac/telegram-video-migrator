from __future__ import annotations

import logging
import os
from typing import Any
import asyncpg

from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.entities.cloning_history import ChannelCloningHistory, ClonedContentItem
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
                    target_channel_title VARCHAR(255)
                );

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
            """)
        self._initialized = True

    async def _ensure_initialized(self) -> None:
        if not self._initialized:
            await self.initialize_schema()

    async def create_job(self, job: MigrationJob) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.create_job(job)

        status_val = job.status.value if isinstance(job.status, JobStatus) else str(job.status)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO migration_jobs (
                    id, source_channel_id, target_channel_id, status,
                    total_videos, processed_videos, last_processed_msg_id,
                    created_at, updated_at, is_full_migration, source_channel_title, target_channel_title
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    total_videos = EXCLUDED.total_videos,
                    processed_videos = EXCLUDED.processed_videos,
                    last_processed_msg_id = EXCLUDED.last_processed_msg_id,
                    is_full_migration = EXCLUDED.is_full_migration,
                    source_channel_title = EXCLUDED.source_channel_title,
                    target_channel_title = EXCLUDED.target_channel_title,
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
                       created_at, updated_at, is_full_migration, source_channel_title, target_channel_title
                FROM migration_jobs
                WHERE id = $1;
                """,
                job_id,
            )
            if not row:
                return None
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
            )

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
            )
            for item in items
        ]
        async with self.pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO migration_queue (
                    job_id, source_message_id, status, media_type, caption, retry_count
                ) VALUES ($1, $2, $3, $4, $5, $6)
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
                   target_message_id, error_message, retry_count, created_at, updated_at
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
                       target_message_id, error_message, retry_count, created_at, updated_at
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
            )

    async def update_queue_item_status(
        self,
        job_id: str,
        source_msg_id: int,
        status: QueueItemStatus,
        target_msg_id: int | None = None,
        error_message: str | None = None,
    ) -> None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            assert self._fallback_repo is not None
            return await self._fallback_repo.update_queue_item_status(
                job_id, source_msg_id, status, target_msg_id, error_message
            )

        status_val = status.value if isinstance(status, QueueItemStatus) else str(status)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE migration_queue
                SET status = $1,
                    target_message_id = COALESCE($2, target_message_id),
                    error_message = $3,
                    updated_at = NOW()
                WHERE job_id = $4 AND source_message_id = $5;
                """,
                status_val,
                target_msg_id,
                error_message,
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
                       created_at, updated_at, is_full_migration, source_channel_title, target_channel_title
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

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None
        if self._fallback_repo is not None:
            await self._fallback_repo.close()
            self._fallback_repo = None
