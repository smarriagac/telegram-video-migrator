from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator
import aiosqlite

from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.ports.job_repository_port import JobRepositoryPort


class SQLiteJobRepository(JobRepositoryPort):
    """aiosqlite implementation of JobRepositoryPort."""

    def __init__(
        self,
        db_path: str = "migration.db",
        connection: aiosqlite.Connection | None = None,
    ) -> None:
        self.db_path = db_path
        self._external_conn = connection
        self._shared_mem_conn: aiosqlite.Connection | None = None
        self._initialized = False

    @asynccontextmanager
    async def _get_connection(self) -> AsyncIterator[aiosqlite.Connection]:
        if self._external_conn is not None:
            yield self._external_conn
        elif self.db_path == ":memory:":
            if self._shared_mem_conn is None:
                self._shared_mem_conn = await aiosqlite.connect(":memory:")
                self._shared_mem_conn.row_factory = aiosqlite.Row
            yield self._shared_mem_conn
        else:
            async with aiosqlite.connect(self.db_path) as conn:
                conn.row_factory = aiosqlite.Row
                yield conn

    async def initialize_schema(self) -> None:
        async with self._get_connection() as conn:
            await conn.execute("PRAGMA foreign_keys = ON;")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS migration_jobs (
                    id TEXT PRIMARY KEY,
                    source_channel_id INTEGER NOT NULL,
                    target_channel_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    total_videos INTEGER NOT NULL DEFAULT 0,
                    processed_videos INTEGER NOT NULL DEFAULT 0,
                    last_processed_msg_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS migration_items (
                    job_id TEXT NOT NULL,
                    source_message_id INTEGER NOT NULL,
                    target_message_id INTEGER NOT NULL,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (job_id, source_message_id),
                    FOREIGN KEY (job_id) REFERENCES migration_jobs(id)
                );
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS migration_queue (
                    job_id TEXT NOT NULL,
                    source_message_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    media_type TEXT NOT NULL DEFAULT 'video',
                    caption TEXT,
                    target_message_id INTEGER,
                    error_message TEXT,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (job_id, source_message_id),
                    FOREIGN KEY (job_id) REFERENCES migration_jobs(id)
                );
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_queue_job_status ON migration_queue(job_id, status);
            """)
            await conn.commit()
            self._initialized = True

    async def _ensure_initialized(self) -> None:
        if not self._initialized:
            await self.initialize_schema()

    async def create_job(self, job: MigrationJob) -> None:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            status_val = job.status.value if isinstance(job.status, JobStatus) else str(job.status)
            await conn.execute(
                """
                INSERT OR REPLACE INTO migration_jobs (
                    id, source_channel_id, target_channel_id, status,
                    total_videos, processed_videos, last_processed_msg_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP));
                """,
                (
                    job.job_id,
                    job.source_id,
                    job.target_id,
                    status_val,
                    job.total_videos,
                    job.processed_videos,
                    job.last_processed_id,
                    job.created_at,
                    job.updated_at,
                ),
            )
            await conn.commit()

    async def update_job_progress(
        self, job_id: str, processed_count: int, last_msg_id: int
    ) -> None:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            await conn.execute(
                """
                UPDATE migration_jobs
                SET processed_videos = ?,
                    last_processed_msg_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?;
                """,
                (processed_count, last_msg_id, job_id),
            )
            await conn.commit()

    async def set_job_status(self, job_id: str, status: JobStatus) -> None:
        await self._ensure_initialized()
        status_val = status.value if isinstance(status, JobStatus) else str(status)
        async with self._get_connection() as conn:
            await conn.execute(
                """
                UPDATE migration_jobs
                SET status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?;
                """,
                (status_val, job_id),
            )
            await conn.commit()

    async def get_job(self, job_id: str) -> MigrationJob | None:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT id, source_channel_id, target_channel_id, status,
                       total_videos, processed_videos, last_processed_msg_id,
                       created_at, updated_at
                FROM migration_jobs
                WHERE id = ?;
                """,
                (job_id,),
            ) as cursor:
                row = await cursor.fetchone()
                if row is None:
                    return None
                return MigrationJob(
                    job_id=str(row[0]),
                    source_id=int(row[1]),
                    target_id=int(row[2]),
                    status=JobStatus(row[3]),
                    total_videos=int(row[4]),
                    processed_videos=int(row[5]),
                    last_processed_id=int(row[6]) if row[6] is not None else None,
                    created_at=str(row[7]) if row[7] is not None else None,
                    updated_at=str(row[8]) if row[8] is not None else None,
                )

    async def record_migrated_item(
        self, job_id: str, source_msg_id: int, target_msg_id: int
    ) -> None:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            await conn.execute(
                """
                INSERT OR REPLACE INTO migration_items (
                    job_id, source_message_id, target_message_id, processed_at
                ) VALUES (?, ?, ?, CURRENT_TIMESTAMP);
                """,
                (job_id, source_msg_id, target_msg_id),
            )
            await conn.commit()

    async def is_item_migrated(self, job_id: str, source_msg_id: int) -> bool:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT 1 FROM migration_items mi
                WHERE mi.job_id = ? AND mi.source_message_id = ?
                UNION
                SELECT 1 FROM migration_items mi
                JOIN migration_jobs mj_orig ON mi.job_id = mj_orig.id
                JOIN migration_jobs mj_curr ON mj_curr.id = ?
                WHERE mj_orig.source_channel_id = mj_curr.source_channel_id
                  AND mj_orig.target_channel_id = mj_curr.target_channel_id
                  AND mi.source_message_id = ?
                LIMIT 1;
                """,
                (job_id, source_msg_id, job_id, source_msg_id),
            ) as cursor:
                row = await cursor.fetchone()
                return row is not None

    async def add_queue_items(self, items: list[QueueItem]) -> None:
        if not items:
            return
        await self._ensure_initialized()
        async with self._get_connection() as conn:
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
            await conn.executemany(
                """
                INSERT OR IGNORE INTO migration_queue (
                    job_id, source_message_id, status, media_type, caption, retry_count
                ) VALUES (?, ?, ?, ?, ?, ?);
                """,
                records,
            )
            await conn.commit()

    async def get_queue_items(
        self, job_id: str, status: QueueItemStatus | None = None
    ) -> list[QueueItem]:
        await self._ensure_initialized()
        query = """
            SELECT job_id, source_message_id, status, media_type, caption,
                   target_message_id, error_message, retry_count, created_at, updated_at
            FROM migration_queue
            WHERE job_id = ?
        """
        params: list[Any] = [job_id]
        if status is not None:
            query += " AND status = ?"
            status_val = status.value if isinstance(status, QueueItemStatus) else str(status)
            params.append(status_val)
        query += " ORDER BY source_message_id ASC;"

        async with self._get_connection() as conn:
            async with conn.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [
                    QueueItem(
                        job_id=str(row[0]),
                        source_message_id=int(row[1]),
                        status=QueueItemStatus(row[2]),
                        media_type=str(row[3]),
                        caption=str(row[4] or ""),
                        target_message_id=int(row[5]) if row[5] is not None else None,
                        error_message=str(row[6]) if row[6] is not None else None,
                        retry_count=int(row[7]),
                        created_at=str(row[8]) if row[8] is not None else None,
                        updated_at=str(row[9]) if row[9] is not None else None,
                    )
                    for row in rows
                ]

    async def get_next_pending_queue_item(self, job_id: str) -> QueueItem | None:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT job_id, source_message_id, status, media_type, caption,
                       target_message_id, error_message, retry_count, created_at, updated_at
                FROM migration_queue
                WHERE job_id = ? AND status = 'PENDING'
                ORDER BY source_message_id ASC
                LIMIT 1;
                """,
                (job_id,),
            ) as cursor:
                row = await cursor.fetchone()
                if row is None:
                    return None
                return QueueItem(
                    job_id=str(row[0]),
                    source_message_id=int(row[1]),
                    status=QueueItemStatus(row[2]),
                    media_type=str(row[3]),
                    caption=str(row[4] or ""),
                    target_message_id=int(row[5]) if row[5] is not None else None,
                    error_message=str(row[6]) if row[6] is not None else None,
                    retry_count=int(row[7]),
                    created_at=str(row[8]) if row[8] is not None else None,
                    updated_at=str(row[9]) if row[9] is not None else None,
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
        status_val = status.value if isinstance(status, QueueItemStatus) else str(status)
        async with self._get_connection() as conn:
            await conn.execute(
                """
                UPDATE migration_queue
                SET status = ?,
                    target_message_id = COALESCE(?, target_message_id),
                    error_message = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE job_id = ? AND source_message_id = ?;
                """,
                (status_val, target_msg_id, error_message, job_id, source_msg_id),
            )
            await conn.commit()

    async def get_queue_stats(self, job_id: str) -> dict[str, int]:
        await self._ensure_initialized()
        stats: dict[str, int] = {
            "total": 0,
            "pending": 0,
            "in_progress": 0,
            "completed": 0,
            "failed": 0,
            "skipped": 0,
        }
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT status, COUNT(*)
                FROM migration_queue
                WHERE job_id = ?
                GROUP BY status;
                """,
                (job_id,),
            ) as cursor:
                rows = await cursor.fetchall()
                for row in rows:
                    st = str(row[0]).lower()
                    cnt = int(row[1])
                    if st in stats:
                        stats[st] = cnt
                    stats["total"] += cnt
        return stats

    async def close(self) -> None:
        if self._shared_mem_conn is not None:
            await self._shared_mem_conn.close()
            self._shared_mem_conn = None


SqliteJobRepository = SQLiteJobRepository
