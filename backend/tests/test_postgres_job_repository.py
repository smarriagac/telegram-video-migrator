from __future__ import annotations

import uuid
import pytest
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.infrastructure.persistence.postgres_job_repository import PostgresJobRepository


@pytest.fixture
async def repo():
    repository = PostgresJobRepository()
    await repository.initialize_schema()
    if repository.pool:
        async with repository.pool.acquire() as conn:
            await conn.execute("DELETE FROM channel_sync_bindings WHERE source_channel_id < -900000;")
            await conn.execute("DELETE FROM migration_queue WHERE job_id LIKE 'pg-test-%';")
            await conn.execute("DELETE FROM migration_items WHERE job_id LIKE 'pg-test-%';")
            await conn.execute("DELETE FROM migration_jobs WHERE id LIKE 'pg-test-%';")
    yield repository
    if repository.pool:
        async with repository.pool.acquire() as conn:
            await conn.execute("DELETE FROM channel_sync_bindings WHERE source_channel_id < -900000;")
            await conn.execute("DELETE FROM migration_queue WHERE job_id LIKE 'pg-test-%';")
            await conn.execute("DELETE FROM migration_items WHERE job_id LIKE 'pg-test-%';")
            await conn.execute("DELETE FROM migration_jobs WHERE id LIKE 'pg-test-%';")
    await repository.close()


@pytest.mark.asyncio
async def test_postgres_create_and_get_job(repo: PostgresJobRepository):
    job_id = f"pg-test-{uuid.uuid4().hex[:8]}"
    job = MigrationJob(
        job_id=job_id,
        source_id=-1001234567,
        target_id=-1009876543,
        status=JobStatus.PENDING,
        total_videos=50,
    )
    await repo.create_job(job)

    fetched = await repo.get_job(job_id)
    assert fetched is not None
    assert fetched.job_id == job_id
    assert fetched.source_id == -1001234567
    assert fetched.target_id == -1009876543
    assert fetched.status == JobStatus.PENDING
    assert fetched.total_videos == 50
    assert fetched.processed_videos == 0
    assert fetched.last_processed_id is None


@pytest.mark.asyncio
async def test_postgres_update_job_progress_and_status(repo: PostgresJobRepository):
    job_id = f"pg-test-{uuid.uuid4().hex[:8]}"
    job = MigrationJob(
        job_id=job_id,
        source_id=-100111,
        target_id=-100222,
        status=JobStatus.RUNNING,
        total_videos=100,
    )
    await repo.create_job(job)

    await repo.update_job_progress(job_id, processed_count=30, last_msg_id=777)
    fetched = await repo.get_job(job_id)
    assert fetched is not None
    assert fetched.processed_videos == 30
    assert fetched.last_processed_id == 777

    await repo.set_job_status(job_id, JobStatus.COMPLETED)
    fetched_done = await repo.get_job(job_id)
    assert fetched_done is not None
    assert fetched_done.status == JobStatus.COMPLETED


@pytest.mark.asyncio
async def test_postgres_migrated_item_idempotency(repo: PostgresJobRepository):
    job_id = f"pg-test-{uuid.uuid4().hex[:8]}"
    rand_src = -1000000 - int(uuid.uuid4().hex[:6], 16)
    rand_tgt = -2000000 - int(uuid.uuid4().hex[:6], 16)
    job = MigrationJob(
        job_id=job_id,
        source_id=rand_src,
        target_id=rand_tgt,
        status=JobStatus.RUNNING,
    )
    await repo.create_job(job)

    assert not await repo.is_item_migrated(job_id, source_msg_id=50)

    await repo.record_migrated_item(job_id, source_msg_id=50, target_msg_id=1050)
    assert await repo.is_item_migrated(job_id, source_msg_id=50)
    assert not await repo.is_item_migrated(job_id, source_msg_id=51)


@pytest.mark.asyncio
async def test_postgres_queue_lifecycle(repo: PostgresJobRepository):
    job_id = f"pg-test-{uuid.uuid4().hex[:8]}"
    await repo.create_job(MigrationJob(job_id=job_id, source_id=10, target_id=20))

    items = [
        QueueItem(job_id=job_id, source_message_id=10, media_type="video", caption="Clip 1"),
        QueueItem(job_id=job_id, source_message_id=20, media_type="photo", caption="Pic 2"),
        QueueItem(job_id=job_id, source_message_id=30, media_type="text", caption="Text 3"),
    ]
    await repo.add_queue_items(items)

    stats = await repo.get_queue_stats(job_id)
    assert stats["total"] == 3
    assert stats["pending"] == 3

    # Next item ordered by source_message_id
    next_item = await repo.get_next_pending_queue_item(job_id)
    assert next_item is not None
    assert next_item.source_message_id == 10

    # Process item 10
    await repo.update_queue_item_status(
        job_id=job_id,
        source_msg_id=10,
        status=QueueItemStatus.COMPLETED,
        target_msg_id=5010,
    )

    next_item_2 = await repo.get_next_pending_queue_item(job_id)
    assert next_item_2 is not None
    assert next_item_2.source_message_id == 20

    # Fail item 20
    await repo.update_queue_item_status(
        job_id=job_id,
        source_msg_id=20,
        status=QueueItemStatus.FAILED,
        error_message="Telegram RPC flood wait error",
    )

    final_stats = await repo.get_queue_stats(job_id)
    assert final_stats["total"] == 3
    assert final_stats["pending"] == 1
    assert final_stats["completed"] == 1
    assert final_stats["failed"] == 1

    all_items = await repo.get_queue_items(job_id)
    assert len(all_items) == 3


@pytest.mark.asyncio
async def test_postgres_sync_binding_lifecycle(repo: PostgresJobRepository):
    from backend.domain.entities.sync_binding import ChannelSyncBinding

    src_id = -999001
    tgt_id = -999002

    binding = ChannelSyncBinding(
        source_channel_id=src_id,
        target_channel_id=tgt_id,
        source_channel_title="PG Source",
        target_channel_title="PG Target",
        source_account_id=1,
        target_account_id=1,
        is_active=True,
        last_synced_message_id=10,
    )

    saved = await repo.save_sync_binding(binding)
    assert saved.is_active is True

    fetched = await repo.get_sync_binding(src_id, tgt_id)
    assert fetched is not None
    assert fetched.source_channel_title == "PG Source"
    assert fetched.last_synced_message_id == 10

    active_list = await repo.get_active_sync_bindings()
    assert any(b.source_channel_id == src_id for b in active_list)

    binding.is_active = False
    await repo.save_sync_binding(binding)
    active_after = await repo.get_active_sync_bindings()
    assert not any(b.source_channel_id == src_id for b in active_after)

    all_list = await repo.list_sync_bindings()
    assert any(b.source_channel_id == src_id for b in all_list)

    deleted = await repo.delete_sync_binding(src_id, tgt_id)
    assert deleted is True
    assert await repo.get_sync_binding(src_id, tgt_id) is None

