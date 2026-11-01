from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import AsyncIterator
import aiosqlite

from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.entities.cloning_history import ChannelCloningHistory, ClonedContentItem
from backend.domain.entities.sync_binding import ChannelSyncBinding
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
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_full_migration BOOLEAN DEFAULT 1,
                    source_title TEXT,
                    target_title TEXT
                );
            """)
            try:
                await conn.execute("ALTER TABLE migration_jobs ADD COLUMN is_full_migration BOOLEAN DEFAULT 1;")
            except Exception:
                pass
            try:
                await conn.execute("ALTER TABLE migration_jobs ADD COLUMN source_title TEXT;")
            except Exception:
                pass
            try:
                await conn.execute("ALTER TABLE migration_jobs ADD COLUMN target_title TEXT;")
            except Exception:
                pass
            try:
                await conn.execute("ALTER TABLE migration_jobs ADD COLUMN source_account_id INTEGER;")
            except Exception:
                pass
            try:
                await conn.execute("ALTER TABLE migration_jobs ADD COLUMN target_account_id INTEGER;")
            except Exception:
                pass
            try:
                await conn.execute("ALTER TABLE migration_jobs ADD COLUMN caption_rules TEXT;")
            except Exception:
                pass
            try:
                await conn.execute("ALTER TABLE migration_jobs ADD COLUMN drip_delay_seconds INTEGER DEFAULT 0;")
            except Exception:
                pass
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
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS channel_sync_bindings (
                    source_channel_id INTEGER NOT NULL,
                    target_channel_id INTEGER NOT NULL,
                    source_channel_title TEXT,
                    target_channel_title TEXT,
                    source_account_id INTEGER,
                    target_account_id INTEGER,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    last_synced_message_id INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    caption_rules TEXT,
                    PRIMARY KEY (source_channel_id, target_channel_id)
                );
            """)
            try:
                await conn.execute("ALTER TABLE channel_sync_bindings ADD COLUMN caption_rules TEXT;")
            except Exception:
                pass
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS migrated_media_fingerprints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_channel_id INTEGER NOT NULL,
                    fingerprint_hash TEXT NOT NULL,
                    source_channel_id INTEGER,
                    source_message_id INTEGER,
                    target_message_id INTEGER,
                    media_type TEXT NOT NULL DEFAULT 'video',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(target_channel_id, fingerprint_hash)
                );
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_media_fingerprint ON migrated_media_fingerprints(target_channel_id, fingerprint_hash);
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
            rules_json = json.dumps(job.caption_rules) if job.caption_rules else None
            await conn.execute(
                """
                INSERT OR REPLACE INTO migration_jobs (
                    id, source_channel_id, target_channel_id, status,
                    total_videos, processed_videos, last_processed_msg_id,
                    created_at, updated_at, is_full_migration, source_title, target_title,
                    source_account_id, target_account_id, caption_rules, drip_delay_seconds
                ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?);
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
                    1 if job.is_full_migration else 0,
                    job.source_title,
                    job.target_title,
                    job.source_account_id,
                    job.target_account_id,
                    rules_json,
                    job.drip_delay_seconds,
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
                       created_at, updated_at, is_full_migration, source_title, target_title,
                       source_account_id, target_account_id, caption_rules, drip_delay_seconds
                FROM migration_jobs
                WHERE id = ?;
                """,
                (job_id,),
            ) as cursor:
                row = await cursor.fetchone()
                if row is None:
                    return None

                parsed_rules = None
                if len(row) > 14 and row[14]:
                    try:
                        parsed_rules = json.loads(row[14]) if isinstance(row[14], str) else row[14]
                    except Exception:
                        parsed_rules = None

                drip_sec = 0
                if len(row) > 15 and row[15] is not None:
                    drip_sec = int(row[15])

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
                    is_full_migration=bool(row[9]) if row[9] is not None else True,
                    source_title=str(row[10]) if row[10] is not None else None,
                    target_title=str(row[11]) if row[11] is not None else None,
                    source_account_id=int(row[12]) if row[12] is not None else None,
                    target_account_id=int(row[13]) if row[13] is not None else None,
                    caption_rules=parsed_rules,
                    drip_delay_seconds=drip_sec,
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

    async def get_channel_cloning_history(self, channel_id: int) -> ChannelCloningHistory:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT id, source_channel_id, target_channel_id, status,
                       total_videos, processed_videos, last_processed_msg_id,
                       created_at, updated_at, is_full_migration, source_title, target_title,
                       source_account_id, target_account_id
                FROM migration_jobs
                WHERE source_channel_id = ?
                ORDER BY created_at DESC;
                """,
                (channel_id,),
            ) as cursor:
                rows = await cursor.fetchall()

            jobs: list[MigrationJob] = []
            for r in rows:
                jobs.append(
                    MigrationJob(
                        job_id=str(r[0]),
                        source_id=int(r[1]),
                        target_id=int(r[2]),
                        status=JobStatus(r[3]),
                        total_videos=int(r[4]),
                        processed_videos=int(r[5]),
                        last_processed_id=int(r[6]) if r[6] is not None else None,
                        created_at=str(r[7]) if r[7] is not None else None,
                        updated_at=str(r[8]) if r[8] is not None else None,
                        is_full_migration=bool(r[9]) if r[9] is not None else True,
                        source_title=str(r[10]) if r[10] is not None else None,
                        target_title=str(r[11]) if r[11] is not None else None,
                        source_account_id=int(r[12]) if r[12] is not None else None,
                        target_account_id=int(r[13]) if r[13] is not None else None,
                    )
                )

            async with conn.execute(
                """
                SELECT COUNT(DISTINCT mi.source_message_id)
                FROM migration_items mi
                JOIN migration_jobs mj ON mi.job_id = mj.id
                WHERE mj.source_channel_id = ?;
                """,
                (channel_id,),
            ) as cursor:
                count_row = await cursor.fetchone()
                total_items_cloned = int(count_row[0]) if count_row and count_row[0] else 0

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
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT mq.job_id, mq.source_message_id, mq.target_message_id,
                       mq.media_type, mq.caption, mq.updated_at,
                       mj.target_channel_id, mj.target_title
                FROM migration_queue mq
                JOIN migration_jobs mj ON mq.job_id = mj.id
                WHERE mj.source_channel_id = ? AND mq.status = 'COMPLETED'
                ORDER BY mq.source_message_id DESC;
                """,
                (channel_id,),
            ) as cursor:
                rows = await cursor.fetchall()

            return [
                ClonedContentItem(
                    job_id=str(r[0]),
                    source_message_id=int(r[1]),
                    target_message_id=int(r[2]) if r[2] is not None else None,
                    media_type=str(r[3]),
                    caption=str(r[4] or ""),
                    migrated_at=str(r[5]) if r[5] is not None else None,
                    target_channel_id=int(r[6]),
                    target_channel_title=str(r[7]) if r[7] is not None else None,
                )
                for r in rows
            ]

    async def get_source_item_for_target(
        self, target_channel_id: int, target_message_id: int
    ) -> tuple[int, int] | None:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT mj.source_channel_id, mq.source_message_id
                FROM migration_queue mq
                JOIN migration_jobs mj ON mq.job_id = mj.id
                WHERE mj.target_channel_id = ? AND mq.target_message_id = ?
                LIMIT 1;
                """,
                (target_channel_id, target_message_id),
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return int(row[0]), int(row[1])
                return None

    async def get_cloned_source_message_ids(
        self, source_channel_id: int, target_channel_id: int
    ) -> set[int]:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT DISTINCT mq.source_message_id
                FROM migration_queue mq
                JOIN migration_jobs mj ON mq.job_id = mj.id
                WHERE mj.source_channel_id = ? AND mj.target_channel_id = ? AND mq.status = 'COMPLETED';
                """,
                (source_channel_id, target_channel_id),
            ) as cursor:
                rows = await cursor.fetchall()
                return {int(r[0]) for r in rows}

    async def save_sync_binding(self, binding: ChannelSyncBinding) -> ChannelSyncBinding:
        await self._ensure_initialized()
        rules_json = json.dumps(binding.caption_rules) if binding.caption_rules else None
        async with self._get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO channel_sync_bindings (
                    source_channel_id, target_channel_id,
                    source_channel_title, target_channel_title,
                    source_account_id, target_account_id,
                    is_active, last_synced_message_id, caption_rules, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (source_channel_id, target_channel_id) DO UPDATE SET
                    source_channel_title = excluded.source_channel_title,
                    target_channel_title = excluded.target_channel_title,
                    source_account_id = excluded.source_account_id,
                    target_account_id = excluded.target_account_id,
                    is_active = excluded.is_active,
                    last_synced_message_id = excluded.last_synced_message_id,
                    caption_rules = excluded.caption_rules,
                    updated_at = CURRENT_TIMESTAMP;
                """,
                (
                    binding.source_channel_id,
                    binding.target_channel_id,
                    binding.source_channel_title,
                    binding.target_channel_title,
                    binding.source_account_id,
                    binding.target_account_id,
                    1 if binding.is_active else 0,
                    binding.last_synced_message_id,
                    rules_json,
                ),
            )
            await conn.commit()
        return binding

    async def get_sync_binding(
        self, source_channel_id: int, target_channel_id: int
    ) -> ChannelSyncBinding | None:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT source_channel_id, target_channel_id,
                       source_channel_title, target_channel_title,
                       source_account_id, target_account_id,
                       is_active, last_synced_message_id, created_at, updated_at,
                       caption_rules
                FROM channel_sync_bindings
                WHERE source_channel_id = ? AND target_channel_id = ?
                LIMIT 1;
                """,
                (source_channel_id, target_channel_id),
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None

                parsed_rules = None
                if len(row) > 10 and row[10]:
                    try:
                        parsed_rules = json.loads(row[10]) if isinstance(row[10], str) else row[10]
                    except Exception:
                        parsed_rules = None

                return ChannelSyncBinding(
                    source_channel_id=int(row[0]),
                    target_channel_id=int(row[1]),
                    source_channel_title=row[2],
                    target_channel_title=row[3],
                    source_account_id=row[4],
                    target_account_id=row[5],
                    is_active=bool(row[6]),
                    last_synced_message_id=int(row[7]),
                    created_at=str(row[8]) if row[8] else None,
                    updated_at=str(row[9]) if row[9] else None,
                    caption_rules=parsed_rules,
                )

    async def get_active_sync_bindings(self) -> list[ChannelSyncBinding]:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT source_channel_id, target_channel_id,
                       source_channel_title, target_channel_title,
                       source_account_id, target_account_id,
                       is_active, last_synced_message_id, created_at, updated_at,
                       caption_rules
                FROM channel_sync_bindings
                WHERE is_active = 1
                ORDER BY updated_at DESC;
                """
            ) as cursor:
                rows = await cursor.fetchall()
                result = []
                for r in rows:
                    parsed_rules = None
                    if len(r) > 10 and r[10]:
                        try:
                            parsed_rules = json.loads(r[10]) if isinstance(r[10], str) else r[10]
                        except Exception:
                            parsed_rules = None
                    result.append(
                        ChannelSyncBinding(
                            source_channel_id=int(r[0]),
                            target_channel_id=int(r[1]),
                            source_channel_title=r[2],
                            target_channel_title=r[3],
                            source_account_id=r[4],
                            target_account_id=r[5],
                            is_active=bool(r[6]),
                            last_synced_message_id=int(r[7]),
                            created_at=str(r[8]) if r[8] else None,
                            updated_at=str(r[9]) if r[9] else None,
                            caption_rules=parsed_rules,
                        )
                    )
                return result

    async def list_sync_bindings(self) -> list[ChannelSyncBinding]:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT source_channel_id, target_channel_id,
                       source_channel_title, target_channel_title,
                       source_account_id, target_account_id,
                       is_active, last_synced_message_id, created_at, updated_at,
                       caption_rules
                FROM channel_sync_bindings
                ORDER BY updated_at DESC;
                """
            ) as cursor:
                rows = await cursor.fetchall()
                result = []
                for r in rows:
                    parsed_rules = None
                    if len(r) > 10 and r[10]:
                        try:
                            parsed_rules = json.loads(r[10]) if isinstance(r[10], str) else r[10]
                        except Exception:
                            parsed_rules = None
                    result.append(
                        ChannelSyncBinding(
                            source_channel_id=int(r[0]),
                            target_channel_id=int(r[1]),
                            source_channel_title=r[2],
                            target_channel_title=r[3],
                            source_account_id=r[4],
                            target_account_id=r[5],
                            is_active=bool(r[6]),
                            last_synced_message_id=int(r[7]),
                            created_at=str(r[8]) if r[8] else None,
                            updated_at=str(r[9]) if r[9] else None,
                            caption_rules=parsed_rules,
                        )
                    )
                return result

    async def delete_sync_binding(
        self, source_channel_id: int, target_channel_id: int
    ) -> bool:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            await conn.execute(
                """
                DELETE FROM channel_sync_bindings
                WHERE source_channel_id = ? AND target_channel_id = ?;
                """,
                (source_channel_id, target_channel_id),
            )
            await conn.commit()
            return True

    async def is_media_fingerprint_duplicated(
        self, target_channel_id: int, fingerprint_hash: str
    ) -> bool:
        await self._ensure_initialized()
        async with self._get_connection() as conn:
            async with conn.execute(
                """
                SELECT 1 FROM migrated_media_fingerprints
                WHERE target_channel_id = ? AND fingerprint_hash = ?
                LIMIT 1;
                """,
                (target_channel_id, fingerprint_hash),
            ) as cursor:
                row = await cursor.fetchone()
                return row is not None

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
        async with self._get_connection() as conn:
            await conn.execute(
                """
                INSERT OR IGNORE INTO migrated_media_fingerprints (
                    target_channel_id, fingerprint_hash, source_channel_id,
                    source_message_id, target_message_id, media_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
                """,
                (
                    target_channel_id,
                    fingerprint_hash,
                    source_channel_id,
                    source_message_id,
                    target_message_id,
                    media_type,
                ),
            )
            await conn.commit()

    async def close(self) -> None:
        if self._shared_mem_conn is not None:
            await self._shared_mem_conn.close()
            self._shared_mem_conn = None


SqliteJobRepository = SQLiteJobRepository
