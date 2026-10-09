from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator
import aiosqlite

from backend.domain.entities.migration_job import JobStatus, MigrationJob
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
                SELECT 1 FROM migration_items
                WHERE job_id = ? AND source_message_id = ?
                LIMIT 1;
                """,
                (job_id, source_msg_id),
            ) as cursor:
                row = await cursor.fetchone()
                return row is not None

    async def close(self) -> None:
        if self._shared_mem_conn is not None:
            await self._shared_mem_conn.close()
            self._shared_mem_conn = None


SqliteJobRepository = SQLiteJobRepository
