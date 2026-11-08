import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

from backend.domain.entities.drip_campaign import (
    CampaignStatus,
    DripCampaign,
    ReservoirItem,
    ReservoirItemStatus,
)
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository
from backend.application.services.drip_campaign_service import DripCampaignService


@pytest.fixture
async def sqlite_repo():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()
    yield repo
    await repo.close()


def test_compute_schedule_timeline():
    start_dt = datetime(2026, 11, 8, 10, 0, 0, tzinfo=timezone.utc)
    
    # 4 items, interval 30 mins, batch size 1
    timeline = DripCampaignService.compute_schedule_timeline(
        start_dt=start_dt,
        count=4,
        interval_minutes=30,
        batch_size=1,
        jitter_seconds=0,
    )
    assert len(timeline) == 4
    assert timeline[0] == "2026-11-08T10:00:00+00:00"
    assert timeline[1] == "2026-11-08T10:30:00+00:00"
    assert timeline[2] == "2026-11-08T11:00:00+00:00"
    assert timeline[3] == "2026-11-08T11:30:00+00:00"


def test_compute_schedule_timeline_daily_window():
    # Start at 21:00 with window 09:00 - 22:00, interval 120 mins (2h)
    start_dt = datetime(2026, 11, 8, 21, 0, 0, tzinfo=timezone.utc)
    timeline = DripCampaignService.compute_schedule_timeline(
        start_dt=start_dt,
        count=3,
        interval_minutes=120,
        batch_size=1,
        jitter_seconds=0,
        daily_window_start="09:00",
        daily_window_end="22:00",
    )
    assert len(timeline) == 3
    # Item 0 is at 21:00 (within window)
    assert "T21:00:00" in timeline[0]
    # Item 1 base would be 23:00 (past 22:00 window), so should roll over to next day 09:00!
    assert "2026-11-09T09:00:00" in timeline[1]


@pytest.mark.asyncio
async def test_drip_campaign_crud(sqlite_repo):
    gateway_mock = AsyncMock()
    service = DripCampaignService(
        job_repo=sqlite_repo,
        telegram_gateway=gateway_mock,
    )

    campaign = await service.create_campaign(
        title="Test Campaign 1",
        source_channel_id=1001,
        target_channel_id=2002,
        source_message_ids=[101, 102, 103],
        interval_minutes=15,
        batch_size=1,
    )
    assert campaign.id.startswith("camp_")
    assert campaign.total_items == 3
    assert campaign.status == CampaignStatus.ACTIVE

    # Fetch campaign
    fetched = await sqlite_repo.get_drip_campaign(campaign.id)
    assert fetched is not None
    assert fetched.title == "Test Campaign 1"
    assert fetched.total_items == 3

    # List items
    items, total = await sqlite_repo.list_reservoir_items(campaign.id)
    assert total == 3
    assert len(items) == 3
    assert items[0].source_message_id == 101
    assert items[1].source_message_id == 102
    assert items[2].source_message_id == 103
    assert items[0].status == ReservoirItemStatus.QUEUED

    # Pause and Resume
    await service.pause_campaign(campaign.id)
    camp_paused = await sqlite_repo.get_drip_campaign(campaign.id)
    assert camp_paused.status == CampaignStatus.PAUSED

    await service.resume_campaign(campaign.id)
    camp_resumed = await sqlite_repo.get_drip_campaign(campaign.id)
    assert camp_resumed.status == CampaignStatus.ACTIVE


@pytest.mark.asyncio
async def test_drip_item_caption_and_skip(sqlite_repo):
    gateway_mock = AsyncMock()
    service = DripCampaignService(
        job_repo=sqlite_repo,
        telegram_gateway=gateway_mock,
    )

    campaign = await service.create_campaign(
        title="Edit & Skip Campaign",
        source_channel_id=1001,
        target_channel_id=2002,
        source_message_ids=[201, 202],
        interval_minutes=60,
    )

    items, _ = await sqlite_repo.list_reservoir_items(campaign.id)
    first_item = items[0]

    # Update caption
    updated = await service.update_item_caption(first_item.id, "New Transformed Caption #exclusive")
    assert updated is not None
    assert updated.transformed_caption == "New Transformed Caption #exclusive"

    # Skip second item
    skipped = await service.skip_item(items[1].id)
    assert skipped is True
    item2 = await sqlite_repo.get_reservoir_item(items[1].id)
    assert item2.status == ReservoirItemStatus.SKIPPED


@pytest.mark.asyncio
async def test_drip_worker_release_due_items(sqlite_repo):
    gateway_mock = AsyncMock()
    gateway_mock.copy_video_by_reference.return_value = 7788

    service = DripCampaignService(
        job_repo=sqlite_repo,
        telegram_gateway=gateway_mock,
    )

    # Create campaign scheduled in the past so it triggers immediately
    past_dt = datetime.now(timezone.utc) - timedelta(minutes=10)
    campaign = await service.create_campaign(
        title="Immediate Trigger Campaign",
        source_channel_id=1001,
        target_channel_id=2002,
        source_message_ids=[301],
        interval_minutes=5,
        start_at=past_dt,
    )

    dispatched = await service.check_and_trigger_drip()
    assert len(dispatched) == 1

    gateway_mock.copy_video_by_reference.assert_called_once()

    # Verify item status is RELEASED
    items, _ = await sqlite_repo.list_reservoir_items(campaign.id)
    assert items[0].status == ReservoirItemStatus.RELEASED
    assert items[0].published_message_id == 7788

    # Verify campaign completed since all items released
    updated_camp = await sqlite_repo.get_drip_campaign(campaign.id)
    assert updated_camp.released_items == 1
    assert updated_camp.status == CampaignStatus.COMPLETED


@pytest.mark.asyncio
async def test_manual_release_item_now(sqlite_repo):
    gateway_mock = AsyncMock()
    gateway_mock.copy_video_by_reference.return_value = 9900

    service = DripCampaignService(
        job_repo=sqlite_repo,
        telegram_gateway=gateway_mock,
    )

    # Scheduled in the future (10 hours from now)
    future_dt = datetime.now(timezone.utc) + timedelta(hours=10)
    campaign = await service.create_campaign(
        title="Future Campaign",
        source_channel_id=1001,
        target_channel_id=2002,
        source_message_ids=[401],
        start_at=future_dt,
    )

    items, _ = await sqlite_repo.list_reservoir_items(campaign.id)
    item_id = items[0].id

    # Manual early release
    success, released_item = await service.release_item_now(item_id)
    assert success is True
    assert released_item.status == ReservoirItemStatus.RELEASED
    assert released_item.published_message_id == 9900
