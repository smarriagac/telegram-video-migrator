import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from backend.application.services.pre_flight_service import (
    PreFlightService,
    PreFlightRequest,
    PreFlightReport,
)
from backend.domain.entities.channel import Channel
from backend.main import app
from backend.presentation.dependencies import get_pre_flight_service


@pytest.mark.asyncio
async def test_pre_flight_success_with_clean_delta():
    """Verify clean pre-flight check when permissions are valid and accounts ready."""
    mock_repo = AsyncMock()
    mock_repo.get_cloned_source_message_ids.return_value = {10, 20}

    mock_gateway = AsyncMock()
    mock_gateway.get_managed_channels.return_value = [
        Channel(id=-1001, title="Canal Origen", can_post=True),
        Channel(id=-1002, title="Canal Destino", can_post=True),
    ]

    mock_pool = MagicMock()
    mock_pool.is_account_on_cooldown.return_value = (False, 0)

    service = PreFlightService(
        job_repo=mock_repo,
        gateway=mock_gateway,
        client_pool=mock_pool,
    )

    req = PreFlightRequest(
        source_channel_id=-1001,
        target_channel_id=-1002,
        selected_message_ids=[100, 101, 102],
        target_account_id=1,
        watermark_enabled=False,
        drip_delay_seconds=2,
    )

    report = await service.validate(req)

    assert report.can_proceed is True
    assert report.target_writable is True
    assert report.account_ready is True
    assert report.total_requested_items == 3
    assert report.already_cloned_items == 0
    assert report.new_items_to_migrate == 3
    assert report.source_title == "Canal Origen"
    assert report.target_title == "Canal Destino"
    assert len(report.errors) == 0


@pytest.mark.asyncio
async def test_pre_flight_fails_when_target_cannot_post():
    """Verify pre-flight halts when target channel lacks posting rights."""
    mock_repo = AsyncMock()
    mock_repo.get_cloned_source_message_ids.return_value = set()

    mock_gateway = AsyncMock()
    mock_gateway.get_managed_channels.return_value = [
        Channel(id=-1001, title="Canal Origen", can_post=True),
        Channel(id=-1002, title="Canal Solo Lectura", can_post=False),
    ]

    service = PreFlightService(
        job_repo=mock_repo,
        gateway=mock_gateway,
        client_pool=None,
    )

    req = PreFlightRequest(
        source_channel_id=-1001,
        target_channel_id=-1002,
        selected_message_ids=[1, 2],
    )

    report = await service.validate(req)

    assert report.can_proceed is False
    assert report.target_writable is False
    assert any("can_post" in err for err in report.errors)


@pytest.mark.asyncio
async def test_pre_flight_detects_duplicates_and_floodwait():
    """Verify deduplication detects existing cloned videos and reports active cooldown."""
    mock_repo = AsyncMock()
    # 2 out of 3 selected IDs are already cloned
    mock_repo.get_cloned_source_message_ids.return_value = {10, 20, 50, 60}

    mock_gateway = AsyncMock()
    mock_gateway.get_managed_channels.return_value = [
        Channel(id=-1001, title="Canal Origen", can_post=True),
        Channel(id=-1002, title="Canal Destino", can_post=True),
    ]

    mock_pool = MagicMock()
    mock_pool.is_account_on_cooldown.return_value = (True, 45)

    service = PreFlightService(
        job_repo=mock_repo,
        gateway=mock_gateway,
        client_pool=mock_pool,
    )

    req = PreFlightRequest(
        source_channel_id=-1001,
        target_channel_id=-1002,
        selected_message_ids=[10, 20, 30],
        target_account_id=2,
    )

    report = await service.validate(req)

    assert report.can_proceed is True
    assert report.account_ready is False
    assert report.cooldown_seconds == 45
    assert report.total_requested_items == 3
    assert report.already_cloned_items == 2
    assert report.new_items_to_migrate == 1
    assert any("FloodWait" in w for w in report.warnings)
    assert any("ya existen" in w for w in report.warnings)


@pytest.mark.asyncio
async def test_pre_flight_api_endpoint():
    """Verify POST /api/jobs/pre-flight returns valid JSON payload."""
    mock_service = AsyncMock()
    mock_service.validate.return_value = PreFlightReport(
        can_proceed=True,
        source_channel_id=111,
        target_channel_id=222,
        source_title="Source",
        target_title="Target",
        total_requested_items=10,
        already_cloned_items=3,
        new_items_to_migrate=7,
        target_writable=True,
        account_ready=True,
        cooldown_seconds=0,
        estimated_disk_required_mb=150.0,
        disk_space_available_mb=5000.0,
        estimated_duration_seconds=40,
        warnings=["3 videos omitidos por duplicados"],
        errors=[],
    )

    app.dependency_overrides[get_pre_flight_service] = lambda: mock_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/jobs/pre-flight",
                json={
                    "source_channel_id": 111,
                    "target_channel_id": 222,
                    "selected_message_ids": [1, 2, 3],
                    "watermark_enabled": False,
                    "drip_delay_seconds": 1,
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["can_proceed"] is True
            assert data["total_requested_items"] == 10
            assert data["already_cloned_items"] == 3
            assert data["new_items_to_migrate"] == 7
            assert len(data["warnings"]) == 1
    finally:
        app.dependency_overrides.pop(get_pre_flight_service, None)
