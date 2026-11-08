import os
import tempfile
import time
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.application.services.crash_recovery_service import (
    CrashRecoveryService,
    DiskOrphanSweeper,
    RecoveryReport,
)
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.entities.scheduled_broadcast import ScheduledBroadcast
from backend.infrastructure.persistence.sqlite_job_repository import SqliteJobRepository


@pytest.fixture
def temp_disk_env():
    """Create a temporary sandbox directory for disk sweeper tests."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield tmp_dir


def test_disk_orphan_sweeper_selective_deletion(temp_disk_env):
    """Verify that only matching temporary video/media files are removed."""
    sweeper = DiskOrphanSweeper(target_dir=temp_disk_env)

    # 1. Create matching orphan files
    orphan_video = os.path.join(temp_disk_env, "tmp_video_123.mp4")
    with open(orphan_video, "wb") as f:
        f.write(b"X" * 1024)

    orphan_part = os.path.join(temp_disk_env, "tg_download.part")
    with open(orphan_part, "wb") as f:
        f.write(b"Y" * 2048)

    orphan_thumb = os.path.join(temp_disk_env, "thumb_frame_01.jpg")
    with open(orphan_thumb, "wb") as f:
        f.write(b"Z" * 512)

    # 2. Create non-matching persistent files
    db_file = os.path.join(temp_disk_env, "app_database.db")
    with open(db_file, "wb") as f:
        f.write(b"KEEP")

    regular_txt = os.path.join(temp_disk_env, "notes.txt")
    with open(regular_txt, "wb") as f:
        f.write(b"KEEP")

    deleted, freed = sweeper.sweep(min_age_seconds=0)

    assert deleted == 3
    assert freed == (1024 + 2048 + 512)
    assert not os.path.exists(orphan_video)
    assert not os.path.exists(orphan_part)
    assert not os.path.exists(orphan_thumb)
    assert os.path.exists(db_file)
    assert os.path.exists(regular_txt)


def test_disk_orphan_sweeper_age_guard(temp_disk_env):
    """Verify that min_age_seconds protects recently written files."""
    sweeper = DiskOrphanSweeper(target_dir=temp_disk_env)

    recent_file = os.path.join(temp_disk_env, "tmp_in_flight.mp4")
    with open(recent_file, "wb") as f:
        f.write(b"RECENT")

    # Sweep with 60 seconds minimum age requirement
    deleted, freed = sweeper.sweep(min_age_seconds=60)
    assert deleted == 0
    assert freed == 0
    assert os.path.exists(recent_file)


@pytest.mark.asyncio
async def test_sqlite_job_repository_orphan_reconciliations():
    """Verify SQLite repo resets RUNNING jobs, IN_PROGRESS queue items, and RUNNING broadcasts."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        db_path = tmp_db.name

    try:
        repo = SqliteJobRepository(db_path=db_path)
        await repo.initialize_schema()

        # 1. Create a job in RUNNING state
        job = MigrationJob(
            job_id="crash-job-1",
            source_id=100,
            target_id=200,
            status=JobStatus.RUNNING,
            total_videos=10,
            processed_videos=3,
        )
        await repo.create_job(job)

        # 2. Insert queue item in IN_PROGRESS state
        item = QueueItem(
            job_id="crash-job-1",
            source_message_id=101,
            status=QueueItemStatus.IN_PROGRESS,
            media_type="video",
        )
        await repo.add_queue_items([item])

        # 3. Create a broadcast in RUNNING state
        broadcast = ScheduledBroadcast(
            id="crash-broadcast-1",
            target_ids=[200],
            text="Testing broadcast",
            status="RUNNING",
        )
        await repo.create_scheduled_broadcast(broadcast)

        # Run reconciliations
        jobs_count = await repo.reconcile_orphaned_jobs()
        queue_count = await repo.reconcile_orphaned_queue_items()
        broadcasts_count = await repo.reconcile_orphaned_broadcasts()

        assert jobs_count == 1
        assert queue_count == 1
        assert broadcasts_count == 1

        # Check refreshed states
        updated_job = await repo.get_job("crash-job-1")
        assert updated_job is not None
        assert updated_job.status == JobStatus.PAUSED

        queue_items = await repo.get_queue_items("crash-job-1")
        assert len(queue_items) == 1
        assert queue_items[0].status == QueueItemStatus.PENDING

        updated_broadcast = await repo.get_scheduled_broadcast("crash-broadcast-1")
        assert updated_broadcast is not None
        assert updated_broadcast.status == "SCHEDULED"
        assert "Interrupted by system restart" in (updated_broadcast.last_error or "")

    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


@pytest.mark.asyncio
async def test_crash_recovery_service_end_to_end(temp_disk_env):
    """Verify CrashRecoveryService coordinates database and disk cleanup, and triggers alerts."""
    mock_repo = AsyncMock()
    mock_repo.reconcile_orphaned_jobs.return_value = 2
    mock_repo.reconcile_orphaned_queue_items.return_value = 5
    mock_repo.reconcile_orphaned_broadcasts.return_value = 1
    mock_repo.reconcile_orphaned_video_processing_jobs.return_value = 0

    mock_alerting = AsyncMock()

    # Create dummy temp file
    dummy_file = os.path.join(temp_disk_env, "tmp_orphaned.mp4")
    with open(dummy_file, "wb") as f:
        f.write(b"A" * 1024 * 1024)  # 1 MB

    sweeper = DiskOrphanSweeper(target_dir=temp_disk_env)
    service = CrashRecoveryService(
        job_repo=mock_repo,
        alerting_service=mock_alerting,
        sweeper=sweeper,
    )

    report = await service.run_recovery(clean_temp_files=True, min_temp_age_seconds=0)

    assert report.orphaned_jobs_count == 2
    assert report.orphaned_queue_items_count == 5
    assert report.orphaned_broadcasts_count == 1
    assert report.temp_files_deleted == 1
    assert report.megabytes_freed == 1.0
    assert report.total_entities_rescued == 8

    # Assert that operational alert was triggered with WARNING severity
    assert mock_alerting.send_alert.called
    call_kwargs = mock_alerting.send_alert.call_args[1]
    assert call_kwargs["severity"] == "WARNING"
    assert "Crash Recovery" in call_kwargs["title"]
    assert "2 trabajos" in call_kwargs["message"]
    assert "5 videos" in call_kwargs["message"]


@pytest.mark.asyncio
async def test_recovery_sweep_api_endpoint():
    """Verify POST /api/jobs/recovery/sweep returns structured RecoveryReport."""
    from httpx import AsyncClient, ASGITransport
    from backend.main import app
    from backend.presentation.dependencies import get_crash_recovery_service

    mock_service = AsyncMock()
    mock_service.run_recovery.return_value = RecoveryReport(
        orphaned_jobs_count=3,
        orphaned_queue_items_count=8,
        orphaned_broadcasts_count=1,
        orphaned_video_jobs_count=0,
        temp_files_deleted=4,
        bytes_freed=2097152,  # 2.0 MB
    )

    app.dependency_overrides[get_crash_recovery_service] = lambda: mock_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/jobs/recovery/sweep?clean_temp_files=true&min_temp_age_seconds=30")
            assert res.status_code == 200
            data = res.json()
            assert data["orphaned_jobs_count"] == 3
            assert data["orphaned_queue_items_count"] == 8
            assert data["orphaned_broadcasts_count"] == 1
            assert data["temp_files_deleted"] == 4
            assert data["megabytes_freed"] == 2.0
            assert data["total_entities_rescued"] == 12
    finally:
        app.dependency_overrides.pop(get_crash_recovery_service, None)

