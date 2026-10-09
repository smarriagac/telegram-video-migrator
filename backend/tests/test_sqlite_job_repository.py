import pytest
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository


@pytest.fixture
async def repo():
    repository = SQLiteJobRepository(db_path=":memory:")
    await repository.initialize_schema()
    yield repository
    await repository.close()


@pytest.mark.asyncio
async def test_create_and_get_job(repo: SQLiteJobRepository):
    job = MigrationJob(
        job_id="job-101",
        source_id=-1001234567,
        target_id=-1009876543,
        status=JobStatus.PENDING,
        total_videos=50,
    )
    await repo.create_job(job)

    fetched = await repo.get_job("job-101")
    assert fetched is not None
    assert fetched.job_id == "job-101"
    assert fetched.source_id == -1001234567
    assert fetched.target_id == -1009876543
    assert fetched.status == JobStatus.PENDING
    assert fetched.total_videos == 50
    assert fetched.processed_videos == 0
    assert fetched.last_processed_id is None


@pytest.mark.asyncio
async def test_get_nonexistent_job(repo: SQLiteJobRepository):
    fetched = await repo.get_job("nonexistent")
    assert fetched is None


@pytest.mark.asyncio
async def test_update_job_progress(repo: SQLiteJobRepository):
    job = MigrationJob(
        job_id="job-102",
        source_id=-100111,
        target_id=-100222,
        status=JobStatus.RUNNING,
        total_videos=100,
    )
    await repo.create_job(job)
    await repo.update_job_progress("job-102", processed_count=25, last_msg_id=505)

    fetched = await repo.get_job("job-102")
    assert fetched is not None
    assert fetched.processed_videos == 25
    assert fetched.last_processed_id == 505


@pytest.mark.asyncio
async def test_set_job_status(repo: SQLiteJobRepository):
    job = MigrationJob(
        job_id="job-103",
        source_id=-100111,
        target_id=-100222,
        status=JobStatus.RUNNING,
    )
    await repo.create_job(job)

    await repo.set_job_status("job-103", JobStatus.PAUSED_FLOOD_WAIT)
    fetched = await repo.get_job("job-103")
    assert fetched is not None
    assert fetched.status == JobStatus.PAUSED_FLOOD_WAIT

    await repo.set_job_status("job-103", JobStatus.COMPLETED)
    fetched = await repo.get_job("job-103")
    assert fetched is not None
    assert fetched.status == JobStatus.COMPLETED


@pytest.mark.asyncio
async def test_migrated_item_tracking_and_idempotency(repo: SQLiteJobRepository):
    job = MigrationJob(
        job_id="job-104",
        source_id=-100111,
        target_id=-100222,
        status=JobStatus.RUNNING,
    )
    await repo.create_job(job)

    assert not await repo.is_item_migrated("job-104", source_msg_id=123)

    await repo.record_migrated_item("job-104", source_msg_id=123, target_msg_id=987)

    assert await repo.is_item_migrated("job-104", source_msg_id=123)
    assert not await repo.is_item_migrated("job-104", source_msg_id=124)
