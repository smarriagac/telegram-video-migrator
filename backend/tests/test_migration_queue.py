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



@pytest.mark.asyncio
async def test_dead_letter_queue_and_granular_retries(repo: SQLiteJobRepository):
    job_id = "test-job-dlq-1"
    await repo.create_job(MigrationJob(job_id=job_id, source_id=10, target_id=20))

    items = [
        QueueItem(job_id=job_id, source_message_id=101, media_type="video", caption="Failed Video 101", status=QueueItemStatus.FAILED, error_message="FloodWait: 300s"),
        QueueItem(job_id=job_id, source_message_id=102, media_type="video", caption="Failed Video 102", status=QueueItemStatus.FAILED, error_message="File too large > 2GB"),
        QueueItem(job_id=job_id, source_message_id=103, media_type="photo", caption="Good Photo", status=QueueItemStatus.COMPLETED),
    ]
    await repo.add_queue_items(items)

    # 1. Query DLQ items
    dlq_items, total = await repo.list_dead_letter_items(limit=10, offset=0, job_id=job_id)
    assert total == 2
    assert len(dlq_items) == 2
    assert all(it.status == QueueItemStatus.FAILED for it in dlq_items)

    # 2. Granular single retry for item 101
    retried = await repo.retry_single_queue_item(job_id, 101)
    assert retried is True

    # Verify 101 is now PENDING and retry_count is 1
    items_after = await repo.get_queue_items(job_id)
    item_101 = next(it for it in items_after if it.source_message_id == 101)
    assert item_101.status == QueueItemStatus.PENDING
    assert item_101.error_message is None
    assert item_101.retry_count == 1

    # Item 102 should still be FAILED
    item_102 = next(it for it in items_after if it.source_message_id == 102)
    assert item_102.status == QueueItemStatus.FAILED

    # 3. Skip item 102
    skipped = await repo.skip_queue_item(job_id, 102)
    assert skipped is True
    items_after_skip = await repo.get_queue_items(job_id)
    item_102_skip = next(it for it in items_after_skip if it.source_message_id == 102)
    assert item_102_skip.status == QueueItemStatus.SKIPPED

    # 4. Update caption for item 101
    updated_cap = await repo.update_queue_item_caption(job_id, 101, "Updated Caption 101")
    assert updated_cap is True
    items_after_cap = await repo.get_queue_items(job_id)
    item_101_cap = next(it for it in items_after_cap if it.source_message_id == 101)
    assert item_101_cap.caption == "Updated Caption 101"

    # DLQ should now be empty for this job
    dlq_empty, total_empty = await repo.list_dead_letter_items(limit=10, offset=0, job_id=job_id)
    assert total_empty == 0
    assert len(dlq_empty) == 0


@pytest.mark.asyncio
async def test_dlq_api_endpoints():
    from httpx import AsyncClient, ASGITransport
    from backend.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a job first
        job_res = await client.post(
            "/api/jobs",
            json={
                "source_channel_id": 9901,
                "target_channel_id": 9902,
                "message_limit": 5,
            },
        )
        assert job_res.status_code == 201
        job_id = job_res.json()["job_id"]

        # 1. Fetch DLQ list
        dlq_res = await client.get("/api/jobs/dlq")
        assert dlq_res.status_code == 200
        assert "items" in dlq_res.json()
        assert "total" in dlq_res.json()

        # 2. Add a failed item manually to repository for testing endpoints
        from backend.presentation.dependencies import get_job_repository
        repo = await get_job_repository()
        await repo.add_queue_items([
            QueueItem(
                job_id=job_id,
                source_message_id=555,
                media_type="video",
                caption="Video Error 555",
                status=QueueItemStatus.FAILED,
                error_message="FLOOD_WAIT_180",
            )
        ])

        # 3. Patch caption
        patch_res = await client.patch(
            f"/api/jobs/{job_id}/queue/555",
            json={"caption": "Nuevo Caption Corregido"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["caption"] == "Nuevo Caption Corregido"

        # 4. Granular retry
        retry_res = await client.post(f"/api/jobs/{job_id}/queue/555/retry")
        assert retry_res.status_code == 200
        assert retry_res.json()["status"] == "PENDING"

        # 5. Skip single item
        skip_res = await client.post(f"/api/jobs/{job_id}/queue/555/skip")
        assert skip_res.status_code == 200
        assert skip_res.json()["status"] == "SKIPPED"


@pytest.mark.asyncio
async def test_dlq_bulk_operations(repo: SQLiteJobRepository):
    job_id = "test-job-dlq-bulk"
    await repo.create_job(MigrationJob(job_id=job_id, source_id=10, target_id=20))

    items = [
        QueueItem(job_id=job_id, source_message_id=201, media_type="video", caption="Fail 201", status=QueueItemStatus.FAILED, error_message="FloodWait"),
        QueueItem(job_id=job_id, source_message_id=202, media_type="video", caption="Fail 202", status=QueueItemStatus.FAILED, error_message="Timeout"),
        QueueItem(job_id=job_id, source_message_id=203, media_type="photo", caption="Fail 203", status=QueueItemStatus.FAILED, error_message="Network"),
        QueueItem(job_id=job_id, source_message_id=204, media_type="photo", caption="Fail 204", status=QueueItemStatus.FAILED, error_message="Media"),
    ]
    await repo.add_queue_items(items)

    # 1. Bulk retry items 201 and 202
    retried_count = await repo.retry_bulk_queue_items([(job_id, 201), (job_id, 202)])
    assert retried_count == 2

    q_items = await repo.get_queue_items(job_id)
    item_201 = next(it for it in q_items if it.source_message_id == 201)
    item_202 = next(it for it in q_items if it.source_message_id == 202)
    assert item_201.status == QueueItemStatus.PENDING
    assert item_201.retry_count == 1
    assert item_201.error_message is None
    assert item_202.status == QueueItemStatus.PENDING
    assert item_202.retry_count == 1

    # 2. Bulk skip items 203 and 204
    skipped_count = await repo.skip_bulk_queue_items([(job_id, 203), (job_id, 204)])
    assert skipped_count == 2

    q_items_after = await repo.get_queue_items(job_id)
    item_203 = next(it for it in q_items_after if it.source_message_id == 203)
    item_204 = next(it for it in q_items_after if it.source_message_id == 204)
    assert item_203.status == QueueItemStatus.SKIPPED
    assert item_204.status == QueueItemStatus.SKIPPED


@pytest.mark.asyncio
async def test_dlq_bulk_api_endpoints():
    from httpx import AsyncClient, ASGITransport
    from backend.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a job first
        job_res = await client.post(
            "/api/jobs",
            json={
                "source_channel_id": 9903,
                "target_channel_id": 9904,
                "message_limit": 5,
            },
        )
        assert job_res.status_code == 201
        job_id = job_res.json()["job_id"]

        from backend.presentation.dependencies import get_job_repository
        repo = await get_job_repository()
        await repo.add_queue_items([
            QueueItem(job_id=job_id, source_message_id=601, media_type="video", caption="Fail 601", status=QueueItemStatus.FAILED, error_message="RPC_ERR"),
            QueueItem(job_id=job_id, source_message_id=602, media_type="video", caption="Fail 602", status=QueueItemStatus.FAILED, error_message="RPC_ERR"),
            QueueItem(job_id=job_id, source_message_id=603, media_type="photo", caption="Fail 603", status=QueueItemStatus.FAILED, error_message="RPC_ERR"),
        ])

        # Test POST /api/jobs/dlq/bulk-retry
        retry_res = await client.post(
            "/api/jobs/dlq/bulk-retry",
            json={
                "items": [
                    {"job_id": job_id, "source_message_id": 601},
                    {"job_id": job_id, "source_message_id": 602},
                ]
            },
        )
        assert retry_res.status_code == 200
        data_retry = retry_res.json()
        assert data_retry["success"] is True
        assert data_retry["retried_count"] == 2

        # Test POST /api/jobs/dlq/bulk-skip
        skip_res = await client.post(
            "/api/jobs/dlq/bulk-skip",
            json={
                "items": [
                    {"job_id": job_id, "source_message_id": 603},
                ]
            },
        )
        assert skip_res.status_code == 200
        data_skip = skip_res.json()
        assert data_skip["success"] is True
        assert data_skip["skipped_count"] == 1


@pytest.mark.asyncio
async def test_dlq_error_filtering_and_summary(repo: SQLiteJobRepository):
    job_id = "test-job-filter-dlq"
    await repo.create_job(MigrationJob(job_id=job_id, source_id=10, target_id=20))

    items = [
        QueueItem(job_id=job_id, source_message_id=1, media_type="video", caption="Cat 1", status=QueueItemStatus.FAILED, error_message="A wait of 42 seconds is required (FloodWaitError)"),
        QueueItem(job_id=job_id, source_message_id=2, media_type="video", caption="Cat 2", status=QueueItemStatus.FAILED, error_message="Connection timed out (TimeoutError)"),
        QueueItem(job_id=job_id, source_message_id=3, media_type="photo", caption="Cat 3", status=QueueItemStatus.FAILED, error_message="ChatAdminRequiredError: Need rights"),
        QueueItem(job_id=job_id, source_message_id=4, media_type="video", caption="Cat 4", status=QueueItemStatus.FAILED, error_message="FFmpeg decoder corrupted bitstream"),
        QueueItem(job_id=job_id, source_message_id=5, media_type="document", caption="Cat 5", status=QueueItemStatus.FAILED, error_message="Unexpected unknown failure"),
    ]
    await repo.add_queue_items(items)

    # 1. Summary aggregation
    summary = await repo.get_dead_letter_summary(job_id)
    assert summary["total_failed"] == 5
    assert summary["by_category"]["FLOOD_WAIT"] == 1
    assert summary["by_category"]["TIMEOUT_NETWORK"] == 1
    assert summary["by_category"]["PERMISSION_AUTH"] == 1
    assert summary["by_category"]["MEDIA_CORRUPT"] == 1
    assert summary["by_category"]["OTHER"] == 1
    assert summary["by_media_type"]["video"] == 3
    assert summary["by_media_type"]["photo"] == 1
    assert summary["by_media_type"]["document"] == 1

    # 2. Filtered list: FLOOD_WAIT only
    flood_items, flood_total = await repo.list_dead_letter_items(error_category="FLOOD_WAIT", job_id=job_id)
    assert flood_total == 1
    assert flood_items[0].source_message_id == 1

    # 3. Filtered list by search term
    search_items, search_total = await repo.list_dead_letter_items(search="corrupted", job_id=job_id)
    assert search_total == 1
    assert search_items[0].source_message_id == 4

    # 4. 1-Click retry by filter: FLOOD_WAIT
    retried_count, affected_jobs = await repo.retry_filtered_queue_items(error_category="FLOOD_WAIT", job_id=job_id)
    assert retried_count == 1
    assert job_id in affected_jobs

    q_items = await repo.get_queue_items(job_id)
    retried_item = next(it for it in q_items if it.source_message_id == 1)
    assert retried_item.status == QueueItemStatus.PENDING

    # 5. 1-Click skip by filter: MEDIA_CORRUPT
    skipped_count = await repo.skip_filtered_queue_items(error_category="MEDIA_CORRUPT", job_id=job_id)
    assert skipped_count == 1
    q_items_after = await repo.get_queue_items(job_id)
    skipped_item = next(it for it in q_items_after if it.source_message_id == 4)
    assert skipped_item.status == QueueItemStatus.SKIPPED


@pytest.mark.asyncio
async def test_dlq_filter_batch_api_endpoints():
    from httpx import AsyncClient, ASGITransport
    from backend.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create job
        job_res = await client.post(
            "/api/jobs",
            json={"source_channel_id": 9905, "target_channel_id": 9906, "message_limit": 5},
        )
        assert job_res.status_code == 201
        job_id = job_res.json()["job_id"]

        from backend.presentation.dependencies import get_job_repository
        repo = await get_job_repository()
        await repo.add_queue_items([
            QueueItem(job_id=job_id, source_message_id=701, media_type="video", caption="Fail 701", status=QueueItemStatus.FAILED, error_message="FloodWaitError: 15s"),
            QueueItem(job_id=job_id, source_message_id=702, media_type="video", caption="Fail 702", status=QueueItemStatus.FAILED, error_message="FloodWaitError: 25s"),
            QueueItem(job_id=job_id, source_message_id=703, media_type="photo", caption="Fail 703", status=QueueItemStatus.FAILED, error_message="TimeoutError: deadline reached"),
        ])

        # Test GET /api/jobs/dlq/summary
        sum_res = await client.get("/api/jobs/dlq/summary")
        assert sum_res.status_code == 200
        sum_data = sum_res.json()
        assert sum_data["total_failed"] >= 3
        assert sum_data["by_category"]["FLOOD_WAIT"] >= 2

        # Test GET /api/jobs/dlq with error_category filter
        filter_res = await client.get(f"/api/jobs/dlq?job_id={job_id}&error_category=FLOOD_WAIT")
        assert filter_res.status_code == 200
        assert filter_res.json()["total"] == 2

        # Test POST /api/jobs/dlq/retry-by-filter
        retry_res = await client.post(
            "/api/jobs/dlq/retry-by-filter",
            json={"job_id": job_id, "error_category": "FLOOD_WAIT"},
        )
        assert retry_res.status_code == 200
        assert retry_res.json()["retried_count"] == 2

        # Test POST /api/jobs/dlq/skip-by-filter
        skip_res = await client.post(
            "/api/jobs/dlq/skip-by-filter",
            json={"job_id": job_id, "error_category": "TIMEOUT_NETWORK"},
        )
        assert skip_res.status_code == 200
        assert skip_res.json()["skipped_count"] == 1


@pytest.mark.asyncio
async def test_media_fingerprint_and_fast_forward_deduplication(repo: SQLiteJobRepository):
    job_id = "test-dedup-job-1"
    target_chan = -100555001
    source_chan = -100555002

    await repo.create_job(MigrationJob(job_id=job_id, source_id=source_chan, target_id=target_chan))

    # Add items to queue
    items = [
        QueueItem(job_id=job_id, source_message_id=101, media_type="video", caption="Duplicate Clip"),
        QueueItem(job_id=job_id, source_message_id=102, media_type="video", caption="Unique Clip"),
    ]
    await repo.add_queue_items(items)

    fp_hash = "a1b2c3d4e5f678901234567890abcdef"
    # Record fingerprint for item 101 on target_chan
    await repo.record_media_fingerprint(
        target_channel_id=target_chan,
        fingerprint_hash=fp_hash,
        source_channel_id=source_chan,
        source_message_id=101,
        target_message_id=9991,
        media_type="video",
    )

    # 1. Lookup by target channel
    matched = await repo.get_media_fingerprint(target_chan, fp_hash)
    assert matched is not None
    assert matched["target_channel_id"] == target_chan
    assert matched["target_message_id"] == 9991
    assert matched["fingerprint_hash"] == fp_hash

    # 2. Lookup anywhere
    anywhere = await repo.find_media_fingerprint_anywhere(fp_hash)
    assert anywhere is not None
    assert anywhere["target_channel_id"] == target_chan
    assert anywhere["target_message_id"] == 9991

    # 3. Simulate Fast-Forward: update queue item with is_deduplicated=True
    await repo.update_queue_item_status(
        job_id=job_id,
        source_msg_id=101,
        status=QueueItemStatus.COMPLETED,
        target_msg_id=matched["target_message_id"],
        error_message="Fast-Forward: Ya existe en destino",
        is_deduplicated=True,
    )

    stats = await repo.get_queue_stats(job_id)
    assert stats["completed"] == 1
    assert stats["deduplicated"] == 1

    # 4. Check global deduplication stats
    dedup_summary = await repo.get_deduplication_stats()
    assert dedup_summary["total_fingerprints"] >= 1
    assert dedup_summary["total_deduplicated_items"] >= 1
    assert dedup_summary["estimated_saved_mb"] >= 25.0


@pytest.mark.asyncio
async def test_deduplication_api_endpoint():
    from httpx import AsyncClient, ASGITransport
    from backend.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/jobs/deduplication/stats")
        assert res.status_code == 200
        data = res.json()
        assert "total_fingerprints" in data
        assert "total_deduplicated_items" in data
        assert "estimated_saved_mb" in data
        assert data["engine_status"] == "ACTIVE"

