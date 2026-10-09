from __future__ import annotations

import asyncio
from typing import Any
import pytest

from backend.domain.entities.channel import Channel
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.video_message import VideoMessage
from backend.domain.exceptions.domain_exceptions import FloodWaitDomainException
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository
from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase


class MockTelegramGateway(TelegramGatewayPort):
    def __init__(self, videos: list[VideoMessage], flood_wait_on_msg_id: int | None = None) -> None:
        self.videos = videos
        self.copied_calls: list[tuple[int, int]] = []
        self.flood_wait_on = flood_wait_on_msg_id
        self.flood_wait_triggered = False

    async def get_managed_channels(self) -> list[Channel]:
        return [
            Channel(id=1, title="Source Channel", can_post=True),
            Channel(id=2, title="Target Channel", can_post=True),
        ]

    async def fetch_channel_videos(
        self, channel_id: int, after_message_id: int | None = None
    ) -> list[VideoMessage]:
        return list(self.videos)

    async def copy_video_by_reference(
        self, target_channel_id: int, video: VideoMessage
    ) -> int:
        if self.flood_wait_on == video.message_id and not self.flood_wait_triggered:
            self.flood_wait_triggered = True
            raise FloodWaitDomainException(seconds=0)  # 0s for fast test

        new_msg_id = 1000 + video.message_id
        self.copied_calls.append((target_channel_id, video.message_id))
        return new_msg_id


@pytest.fixture
async def repo():
    repository = SQLiteJobRepository(db_path=":memory:")
    await repository.initialize_schema()
    yield repository
    await repository.close()


@pytest.mark.asyncio
async def test_worker_copies_videos_and_emits_progress(repo: SQLiteJobRepository):
    videos = [
        VideoMessage(
            message_id=10,
            input_document_id=1001,
            access_hash=2001,
            file_reference=b"ref1",
            caption="Tutorial part 1 #python",
        ),
        VideoMessage(
            message_id=11,
            input_document_id=1002,
            access_hash=2002,
            file_reference=b"ref2",
            caption="Tutorial part 2 #fastapi",
        ),
    ]
    gateway = MockTelegramGateway(videos)
    use_case = CloneChannelVideosUseCase(
        telegram_gateway=gateway,
        job_repository=repo,
        min_delay_seconds=0.01,
        max_delay_seconds=0.02,
    )

    job = MigrationJob(job_id="test-job-1", source_id=1, target_id=2)
    await repo.create_job(job)

    progress_events: list[dict[str, Any]] = []

    async def on_progress(event: dict[str, Any]):
        progress_events.append(event)

    result_job = await use_case.execute("test-job-1", on_progress=on_progress)

    assert result_job.status == JobStatus.COMPLETED
    assert result_job.processed_videos == 2
    assert result_job.total_videos == 2
    assert len(gateway.copied_calls) == 2
    assert gateway.copied_calls == [(2, 10), (2, 11)]

    # Check that events were emitted
    assert any(e.get("status") == JobStatus.RUNNING.value for e in progress_events)
    assert any(e.get("status") == JobStatus.COMPLETED.value for e in progress_events)

    # Check database idempotency
    assert await repo.is_item_migrated("test-job-1", 10)
    assert await repo.is_item_migrated("test-job-1", 11)


@pytest.mark.asyncio
async def test_worker_skips_already_migrated_items_idempotently(repo: SQLiteJobRepository):
    videos = [
        VideoMessage(message_id=20, input_document_id=101, access_hash=201, file_reference=b"a", caption="vid 20"),
        VideoMessage(message_id=21, input_document_id=102, access_hash=202, file_reference=b"b", caption="vid 21"),
    ]
    gateway = MockTelegramGateway(videos)
    use_case = CloneChannelVideosUseCase(
        telegram_gateway=gateway,
        job_repository=repo,
        min_delay_seconds=0.01,
        max_delay_seconds=0.02,
    )

    job = MigrationJob(job_id="test-job-2", source_id=1, target_id=2)
    await repo.create_job(job)

    # Pre-record item 20 as already migrated
    await repo.record_migrated_item("test-job-2", source_msg_id=20, target_msg_id=999)

    await use_case.execute("test-job-2")

    # Gateway should ONLY have been called for message 21
    assert len(gateway.copied_calls) == 1
    assert gateway.copied_calls == [(2, 21)]


@pytest.mark.asyncio
async def test_worker_recovers_from_flood_wait(repo: SQLiteJobRepository):
    videos = [
        VideoMessage(message_id=30, input_document_id=301, access_hash=401, file_reference=b"c", caption="vid 30"),
    ]
    gateway = MockTelegramGateway(videos, flood_wait_on_msg_id=30)
    use_case = CloneChannelVideosUseCase(
        telegram_gateway=gateway,
        job_repository=repo,
        min_delay_seconds=0.01,
        max_delay_seconds=0.02,
    )

    job = MigrationJob(job_id="test-job-3", source_id=1, target_id=2)
    await repo.create_job(job)

    events: list[dict[str, Any]] = []

    async def on_progress(event: dict[str, Any]):
        events.append(event)

    result_job = await use_case.execute("test-job-3", on_progress=on_progress)

    assert result_job.status == JobStatus.COMPLETED
    assert result_job.processed_videos == 1
    assert any(e.get("status") == JobStatus.PAUSED_FLOOD_WAIT.value for e in events)
