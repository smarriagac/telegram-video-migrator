from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest

from backend.application.services.alerting_service import AlertingService
from backend.application.services.live_sync_service import LiveSyncService
from backend.application.services.broadcast_scheduler_service import BroadcastSchedulerService
from backend.domain.entities.sync_binding import ChannelSyncBinding
from backend.domain.entities.scheduled_broadcast import ScheduledBroadcast
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository


@pytest.mark.asyncio
async def test_alerting_service_direct_message():
    mock_gateway = MagicMock()
    mock_gateway.send_direct_message = AsyncMock(return_value=True)

    service = AlertingService(gateway=mock_gateway, default_recipient="@Smpyt")
    delivered = await service.send_alert(
        title="Test Alert",
        message="Mensaje de prueba",
        severity="WARNING",
    )

    assert delivered is True
    assert mock_gateway.send_direct_message.called
    kwargs = mock_gateway.send_direct_message.call_args[1]
    assert kwargs["recipient"] == "@Smpyt"
    assert "Test Alert" in kwargs["text"]
    assert "⚠️" in kwargs["text"]


@pytest.mark.asyncio
async def test_alerting_service_graceful_failure():
    mock_gateway = MagicMock()
    mock_gateway.send_direct_message = AsyncMock(side_effect=Exception("Network unreachable"))

    service = AlertingService(gateway=mock_gateway, default_recipient="@Smpyt")
    # Must not raise exception
    delivered = await service.send_alert(
        title="Fail Alert",
        message="This will fail gracefully",
        severity="ERROR",
    )
    assert delivered is False


@pytest.mark.asyncio
async def test_live_sync_triggers_eviction_alert():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_client = AsyncMock()
    mock_client.is_connected = MagicMock(return_value=True)
    mock_client.get_input_entity = AsyncMock(
        side_effect=ValueError("Could not find the input entity for PeerChannel")
    )

    mock_pool = MagicMock()
    mock_pool.get_client.return_value = mock_client
    mock_pool.list_clients.return_value = [(1, "Cuenta Principal", mock_client)]

    mock_alerting = MagicMock()
    mock_alerting.notify_channel_eviction = AsyncMock(return_value=True)

    service = LiveSyncService(
        job_repository=repo,
        client_pool=mock_pool,
        migration_use_case=MagicMock(),
        broadcaster=MagicMock(),
        alerting_service=mock_alerting,
    )

    binding = ChannelSyncBinding(
        source_channel_id=-1003954412662,
        target_channel_id=-1004337257363,
        source_channel_title="La aldea del cacique",
        source_account_id=1,
        is_active=True,
    )
    await repo.save_sync_binding(binding)

    await service.catch_up_delta(binding)
    await asyncio.sleep(0.05)

    assert mock_alerting.notify_channel_eviction.called
    kwargs = mock_alerting.notify_channel_eviction.call_args[1]
    assert kwargs["source_channel_id"] == -1003954412662
    assert kwargs["source_title"] == "La aldea del cacique"
    assert kwargs["account_id"] == 1

    await repo.close()


@pytest.mark.asyncio
async def test_broadcast_scheduler_triggers_failure_alert():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_gateway = MagicMock()
    mock_gateway.broadcast_message = AsyncMock(side_effect=Exception("Telegram connection lost"))

    mock_alerting = MagicMock()
    mock_alerting.notify_broadcast_failure = AsyncMock(return_value=True)

    service = BroadcastSchedulerService(
        job_repo=repo,
        telegram_gateway=mock_gateway,
        alerting_service=mock_alerting,
    )

    item = ScheduledBroadcast(
        id="failing-broadcast",
        name="Campaña Fallida",
        target_ids=[-100111],
        text="Aviso que fallará",
        scheduled_at=(datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        recurrence="ONCE",
        status="SCHEDULED",
    )
    await repo.create_scheduled_broadcast(item)

    await service.check_and_trigger_scheduled_broadcasts()
    await asyncio.sleep(0.05)

    assert mock_alerting.notify_broadcast_failure.called
    kwargs = mock_alerting.notify_broadcast_failure.call_args[1]
    assert kwargs["campaign_name"] == "Campaña Fallida"
    assert kwargs["campaign_id"] == "failing-broadcast"
    assert "Telegram connection lost" in kwargs["error_details"]

    await repo.close()
