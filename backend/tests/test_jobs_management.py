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

        app.dependency_overrides.clear()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
