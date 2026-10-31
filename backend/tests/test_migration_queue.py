from __future__ import annotations

import pytest
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.entities.migration_job import MigrationJob
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository


@pytest.fixture
async def repo():
    repository = SQLiteJobRepository(db_path=":memory:")
    await repository.initialize_schema()
    yield repository
    await repository.close()


@pytest.mark.asyncio
async def test_queue_lifecycle(repo: SQLiteJobRepository):
    job_id = "test-job-queue-1"

    # Pre-requisite: Job record
    await repo.create_job(MigrationJob(job_id=job_id, source_id=10, target_id=20))

    # 1. Add queue items
    items = [
        QueueItem(job_id=job_id, source_message_id=1, media_type="video", caption="Video 1"),
        QueueItem(job_id=job_id, source_message_id=2, media_type="photo", caption="Photo 2"),
        QueueItem(job_id=job_id, source_message_id=3, media_type="text", caption="Text 3"),
    ]
    await repo.add_queue_items(items)

    # 2. Get queue stats
    stats = await repo.get_queue_stats(job_id)
    assert stats["total"] == 3
    assert stats["pending"] == 3
    assert stats["completed"] == 0
    assert stats["failed"] == 0

    # 3. Get next pending item (should be message 1)
    next_item = await repo.get_next_pending_queue_item(job_id)
    assert next_item is not None
    assert next_item.source_message_id == 1
    assert next_item.status == QueueItemStatus.PENDING

    # 4. Update status to IN_PROGRESS then COMPLETED
    await repo.update_queue_item_status(
        job_id=job_id,
        source_msg_id=1,
        status=QueueItemStatus.COMPLETED,
        target_msg_id=1001,
    )

    # 5. Get next pending item (should now be message 2)
    next_item_2 = await repo.get_next_pending_queue_item(job_id)
    assert next_item_2 is not None
    assert next_item_2.source_message_id == 2

    # 6. Mark message 2 as FAILED
    await repo.update_queue_item_status(
        job_id=job_id,
        source_msg_id=2,
        status=QueueItemStatus.FAILED,
        error_message="Network timeout during upload",
    )

    # 7. Check final stats
    final_stats = await repo.get_queue_stats(job_id)
    assert final_stats["total"] == 3
    assert final_stats["pending"] == 1
    assert final_stats["completed"] == 1
    assert final_stats["failed"] == 1

    # 8. List all queue items
    all_items = await repo.get_queue_items(job_id)
    assert len(all_items) == 3
    failed_item = next(it for it in all_items if it.source_message_id == 2)
    assert failed_item.status == QueueItemStatus.FAILED
    assert failed_item.error_message == "Network timeout during upload"
