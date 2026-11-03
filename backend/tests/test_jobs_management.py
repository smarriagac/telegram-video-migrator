import pytest
import tempfile
import os
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.domain.entities.migration_job import MigrationJob, JobStatus
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.infrastructure.persistence.sqlite_job_repository import SqliteJobRepository
from backend.presentation.dependencies import get_job_repository


@pytest.mark.asyncio
async def test_list_and_manage_jobs():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        repo = SqliteJobRepository(db_path=db_path)
        await repo.initialize_schema()

        app.dependency_overrides[get_job_repository] = lambda: repo

        # 1. Create a job
        job = MigrationJob(
            job_id="job-test-123",
            source_id=-100111,
            target_id=-100222,
            status=JobStatus.RUNNING,
            total_videos=10,
            processed_videos=3,
            source_title="Source Test",
            target_title="Target Test",
        )
        await repo.create_job(job)

        # Add queue items with 1 failed
        items = [
            QueueItem(job_id="job-test-123", source_message_id=1, status=QueueItemStatus.COMPLETED),
            QueueItem(job_id="job-test-123", source_message_id=2, status=QueueItemStatus.FAILED, error_message="FloodWait"),
        ]
        await repo.add_queue_items(items)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Test GET /api/jobs
            resp = await client.get("/api/jobs")
            assert resp.status_code == 200
            data = resp.json()
            assert data["total"] >= 1
            assert any(j["job_id"] == "job-test-123" for j in data["items"])

            # Test POST /api/jobs/{job_id}/pause
            pause_resp = await client.post("/api/jobs/job-test-123/pause")
            assert pause_resp.status_code == 200
            assert pause_resp.json()["status"] == "PAUSED"

            # Verify job is paused
            job_check = await repo.get_job("job-test-123")
            assert job_check.status == JobStatus.PAUSED

            # Test POST /api/jobs/{job_id}/retry
            retry_resp = await client.post("/api/jobs/job-test-123/retry")
            assert retry_resp.status_code == 200
            assert retry_resp.json()["requeued_items"] == 1

            # Test DELETE /api/jobs/{job_id}
            del_resp = await client.delete("/api/jobs/job-test-123")
            assert del_resp.status_code == 200
            assert del_resp.json()["deleted"] == "true"

            # Verify job is deleted
            deleted_job = await repo.get_job("job-test-123")
            assert deleted_job is None

            # Test reconcile_orphaned_jobs
            zombie_job = MigrationJob(
                job_id="zombie-1",
                source_id=-1,
                target_id=-2,
                status=JobStatus.RUNNING,
            )
            await repo.create_job(zombie_job)
            reconciled = await repo.reconcile_orphaned_jobs()
            assert reconciled >= 1
            zombie_check = await repo.get_job("zombie-1")
            assert zombie_check.status == JobStatus.PAUSED

            # Test JobSchedulerService trigger
            from backend.application.services.job_scheduler_service import JobSchedulerService
            from unittest.mock import MagicMock
            mock_uc = MagicMock()
            mock_bc = MagicMock()

            sched_job = MigrationJob(
                job_id="sched-test-1",
                source_id=-1,
                target_id=-2,
                status=JobStatus.SCHEDULED,
                scheduled_at="2020-01-01T00:00:00Z",  # In the past -> should trigger immediately
            )
            await repo.create_job(sched_job)

            scheduler_service = JobSchedulerService(
                job_repo=repo,
                use_case=mock_uc,
                broadcaster=mock_bc,
                poll_interval=1.0,
            )
            triggered = await scheduler_service.check_and_trigger_scheduled_jobs()
            assert "sched-test-1" in triggered
            updated_sched = await repo.get_job("sched-test-1")
            assert updated_sched.status == JobStatus.RUNNING

        app.dependency_overrides.clear()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


@pytest.mark.asyncio
async def test_scheduled_job_with_selected_message_ids_preserved():
    """Verify that selective message filtering is strictly preserved across scheduling and execution."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        repo = SqliteJobRepository(db_path=db_path)
        await repo.initialize_schema()

        app.dependency_overrides[get_job_repository] = lambda: repo

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Create a scheduled migration job with ONLY 1 selected message (ID 42)
            create_payload = {
                "source_channel_id": -100111,
                "target_channel_id": -100222,
                "source_channel_title": "Origen",
                "target_channel_title": "Destino",
                "selected_message_ids": [42],
                "scheduled_at": "2030-01-01T00:00:00Z",
            }
            resp = await client.post("/api/jobs", json=create_payload)
            assert resp.status_code == 201
            data = resp.json()
            job_id = data["job_id"]
            assert data["status"] == "SCHEDULED"
            assert data["total_videos"] == 1

            # 2. Verify stored job has selected_message_ids in media_filter_rules metadata
            stored_job = await repo.get_job(job_id)
            assert stored_job is not None
            assert stored_job.media_filter_rules is not None
            assert stored_job.media_filter_rules.get("selected_message_ids") == [42]

            # 3. Verify use_case recovers selected_message_ids if dispatched without them
            from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase
            from backend.domain.entities.video_message import VideoMessage
            from unittest.mock import AsyncMock

            mock_gw = AsyncMock()
            # Channel actually has 4 messages: 40, 41, 42, 43
            mock_gw.fetch_channel_videos.return_value = [
                VideoMessage(message_id=40, caption="Video 40", media_type="video"),
                VideoMessage(message_id=41, caption="Video 41", media_type="video"),
                VideoMessage(message_id=42, caption="Video 42", media_type="video"),
                VideoMessage(message_id=43, caption="Video 43", media_type="video"),
            ]
            mock_gw.copy_video_by_reference.return_value = 999

            use_case = CloneChannelVideosUseCase(
                telegram_gateway=mock_gw,
                job_repository=repo,
                min_delay_seconds=0.0,
            )

            # Execute without passing selected_message_ids (simulating run-now or scheduler pickup)
            executed_job = await use_case.execute(job_id=job_id, selected_message_ids=None)
            assert executed_job.status == JobStatus.COMPLETED

            # Crucial assertion: Only message 42 was queued and cloned, NOT all 4!
            queue_items = await repo.get_queue_items(job_id)
            assert len(queue_items) == 1
            assert queue_items[0].source_message_id == 42
            assert executed_job.processed_videos == 1
            assert executed_job.total_videos == 1

        app.dependency_overrides.clear()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)

