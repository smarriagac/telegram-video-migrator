from __future__ import annotations

import uuid
import pytest
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.infrastructure.persistence.postgres_job_repository import PostgresJobRepository
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository


@pytest.fixture(params=["sqlite", "postgres"])
async def repo(request):
    if request.param == "sqlite":
        repository = SQLiteJobRepository(db_path=":memory:")
        await repository.initialize_schema()
        yield repository
        await repository.close()
    else:
        repository = PostgresJobRepository()
        await repository.initialize_schema()
        if repository.pool:
            async with repository.pool.acquire() as conn:
                await conn.execute("DELETE FROM migration_queue WHERE job_id LIKE 'audit-test-%';")
                await conn.execute("DELETE FROM migration_items WHERE job_id LIKE 'audit-test-%';")
                await conn.execute("DELETE FROM migration_jobs WHERE id LIKE 'audit-test-%';")
        yield repository
        if repository.pool:
            async with repository.pool.acquire() as conn:
                await conn.execute("DELETE FROM migration_queue WHERE job_id LIKE 'audit-test-%';")
                await conn.execute("DELETE FROM migration_items WHERE job_id LIKE 'audit-test-%';")
                await conn.execute("DELETE FROM migration_jobs WHERE id LIKE 'audit-test-%';")
        await repository.close()


@pytest.mark.asyncio
async def test_channel_cloning_history_and_content_audit(repo):
    channel_id = -100999000 - int(uuid.uuid4().hex[:4], 16)
    target_id_1 = -100888001
    target_id_2 = -100888002

    # Job 1: Full migration, completed with 2 videos
    job_1_id = f"audit-test-{uuid.uuid4().hex[:8]}"
    job_1 = MigrationJob(
        job_id=job_1_id,
        source_id=channel_id,
        target_id=target_id_1,
        status=JobStatus.COMPLETED,
        total_videos=2,
        processed_videos=2,
        is_full_migration=True,
        source_title="Canal Noticias",
        target_title="Backup Noticias",
    )
    await repo.create_job(job_1)

    items_job_1 = [
        QueueItem(job_id=job_1_id, source_message_id=101, media_type="video", caption="Video Noticia 1"),
        QueueItem(job_id=job_1_id, source_message_id=102, media_type="photo", caption="Foto Noticia 2"),
    ]
    await repo.add_queue_items(items_job_1)
    await repo.update_queue_item_status(job_1_id, 101, QueueItemStatus.COMPLETED, target_msg_id=2001)
    await repo.update_queue_item_status(job_1_id, 102, QueueItemStatus.COMPLETED, target_msg_id=2002)
    await repo.record_migrated_item(job_1_id, 101, 2001)
    await repo.record_migrated_item(job_1_id, 102, 2002)

    # Job 2: Selective migration (partial), completed with 1 item, 1 failed
    job_2_id = f"audit-test-{uuid.uuid4().hex[:8]}"
    job_2 = MigrationJob(
        job_id=job_2_id,
        source_id=channel_id,
        target_id=target_id_2,
        status=JobStatus.COMPLETED,
        total_videos=2,
        processed_videos=2,
        is_full_migration=False,
        source_title="Canal Noticias",
        target_title="VIP Noticias",
    )
    await repo.create_job(job_2)

    items_job_2 = [
        QueueItem(job_id=job_2_id, source_message_id=103, media_type="video", caption="Video Extra 3"),
        QueueItem(job_id=job_2_id, source_message_id=104, media_type="text", caption="Texto 4"),
    ]
    await repo.add_queue_items(items_job_2)
    await repo.update_queue_item_status(job_2_id, 103, QueueItemStatus.COMPLETED, target_msg_id=3003)
    await repo.update_queue_item_status(job_2_id, 104, QueueItemStatus.FAILED, error_message="FloodWait")
    await repo.record_migrated_item(job_2_id, 103, 3003)

    # 1. Query Channel Cloning History
    history = await repo.get_channel_cloning_history(channel_id)
    assert history.channel_id == channel_id
    assert history.total_clones == 2
    assert history.has_full_clone is True
    assert history.total_items_cloned == 3  # 2 from job 1, 1 from job 2
    assert len(history.jobs) == 2

    # Check job 1 details
    j1 = next(j for j in history.jobs if j.job_id == job_1_id)
    assert j1.is_full_migration is True
    assert j1.source_title == "Canal Noticias"
    assert j1.target_title == "Backup Noticias"

    # Check job 2 details
    j2 = next(j for j in history.jobs if j.job_id == job_2_id)
    assert j2.is_full_migration is False

    # 2. Query Cloned Content Audit
    content = await repo.get_cloned_content_for_channel(channel_id)
    assert len(content) == 3

    # All returned items must be completed
    msg_ids = {it.source_message_id for it in content}
    assert msg_ids == {101, 102, 103}
    assert 104 not in msg_ids  # Failed item should not be in cloned content

    c101 = next(it for it in content if it.source_message_id == 101)
    assert c101.target_message_id == 2001
    assert c101.media_type == "video"
    assert c101.caption == "Video Noticia 1"
