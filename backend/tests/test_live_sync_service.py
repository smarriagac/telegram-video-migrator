from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock
import pytest

from backend.application.services.live_sync_service import LiveSyncService
from backend.domain.entities.sync_binding import ChannelSyncBinding
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository


@pytest.mark.asyncio
async def test_live_sync_service_lifecycle_and_processing():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_pool = MagicMock()
    mock_pool.list_clients.return_value = []

    mock_use_case = MagicMock()
    mock_use_case.execute = AsyncMock()

    mock_broadcaster = MagicMock()
    mock_broadcaster.broadcast = AsyncMock()

    service = LiveSyncService(
        job_repository=repo,
        client_pool=mock_pool,
        migration_use_case=mock_use_case,
        broadcaster=mock_broadcaster,
    )

    await service.start()

    # Create binding
    src_id = -100111
    tgt_id = -100222
    binding = await service.set_binding(
        source_channel_id=src_id,
        target_channel_id=tgt_id,
        is_active=True,
        source_title="Source",
        target_title="Target",
    )
    assert binding.is_active is True

    # Simulate incoming message event
    mock_event = MagicMock()
    mock_event.chat_id = src_id
    mock_msg = MagicMock()
    mock_msg.id = 777
    mock_msg.video = MagicMock()
    mock_msg.photo = None
    mock_msg.document = None
    mock_msg.message = "Nuevo video sincronizado en vivo"
    mock_event.message = mock_msg

    await service._handle_incoming_event(mock_event, account_id=1)

    # Wait for queue consumer to process item
    await asyncio.sleep(0.1)

    assert mock_use_case.execute.called
    job_id = f"sync_{abs(src_id)}_{abs(tgt_id)}_777"
    mock_use_case.execute.assert_called_with(job_id, on_progress=mock_use_case.execute.call_args[1]["on_progress"])

    # Check updated binding
    updated_binding = await repo.get_sync_binding(src_id, tgt_id)
    assert updated_binding is not None
    assert updated_binding.last_synced_message_id == 777

    # Simulate duplicate incoming event (idempotency)
    mock_use_case.execute.reset_mock()
    # Mark item 777 as completed in repository queue
    from backend.domain.entities.queue_item import QueueItemStatus
    await repo.update_queue_item_status(job_id, 777, QueueItemStatus.COMPLETED, 999)

    await service._handle_incoming_event(mock_event, account_id=1)
    await asyncio.sleep(0.05)

    # Use case should not be executed again because it's already cloned
    assert not mock_use_case.execute.called

    await service.stop()
    await repo.close()


@pytest.mark.asyncio
async def test_live_sync_catch_up_delta():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_client = AsyncMock()
    mock_client.is_connected = MagicMock(return_value=False)
    mock_client.connect = AsyncMock()
    mock_client.get_input_entity = AsyncMock(return_value="entity")

    msg_missed = MagicMock()
    msg_missed.id = 888
    msg_missed.video = None
    msg_missed.photo = None
    msg_missed.document = None
    msg_missed.message = "Missed post"

    mock_client.get_messages = AsyncMock(return_value=[msg_missed])

    mock_pool = MagicMock()
    mock_pool.get_client.return_value = mock_client
    mock_pool.list_clients.return_value = [(1, "Cuenta Principal", mock_client)]

    mock_use_case = MagicMock()
    mock_use_case.execute = AsyncMock()

    mock_broadcaster = MagicMock()
    mock_broadcaster.broadcast = AsyncMock()

    service = LiveSyncService(
        job_repository=repo,
        client_pool=mock_pool,
        migration_use_case=mock_use_case,
        broadcaster=mock_broadcaster,
    )

    binding = ChannelSyncBinding(
        source_channel_id=-100111,
        target_channel_id=-100222,
        is_active=True,
    )

    enqueued = await service.catch_up_delta(binding)
    assert enqueued == 1
    assert mock_client.connect.called
    assert service._queue.qsize() == 1

    await repo.close()


@pytest.mark.asyncio
async def test_live_sync_catch_up_delta_detects_access_revoked():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_client = AsyncMock()
    mock_client.is_connected = MagicMock(return_value=True)
    mock_client.get_input_entity = AsyncMock(
        side_effect=ValueError("Could not find the input entity for PeerChannel(channel_id=3954412662)")
    )

    mock_pool = MagicMock()
    mock_pool.get_client.return_value = mock_client
    mock_pool.list_clients.return_value = [(1, "Cuenta Principal", mock_client)]

    service = LiveSyncService(
        job_repository=repo,
        client_pool=mock_pool,
        migration_use_case=MagicMock(),
        broadcaster=MagicMock(),
    )

    binding = ChannelSyncBinding(
        source_channel_id=-1003954412662,
        target_channel_id=-1004337257363,
        source_channel_title="La aldea del cacique",
        is_active=True,
    )
    await repo.save_sync_binding(binding)

    enqueued = await service.catch_up_delta(binding)
    assert enqueued == 0

    updated = await repo.get_sync_binding(-1003954412662, -1004337257363)
    assert updated is not None
    assert updated.status == "ACCESS_REVOKED"
    assert updated.is_active is False
    assert "expulsada" in updated.last_error.lower()

    await repo.close()


@pytest.mark.asyncio
async def test_live_sync_switch_binding_account_success():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_client1 = AsyncMock()
    mock_client1.on = MagicMock(return_value=lambda f: f)
    mock_client2 = AsyncMock()
    mock_client2.on = MagicMock(return_value=lambda f: f)
    mock_client2.is_connected = MagicMock(return_value=False)
    mock_client2.connect = AsyncMock()
    mock_client2.get_input_entity = AsyncMock(return_value="entity_ok")
    mock_client2.get_messages = AsyncMock(return_value=[])

    mock_pool = MagicMock()
    mock_pool.get_client.side_effect = lambda acc_id: mock_client2 if acc_id == 2 else mock_client1
    mock_pool.list_clients.return_value = [(1, "Cuenta 1", mock_client1), (2, "Cuenta 2", mock_client2)]

    service = LiveSyncService(
        job_repository=repo,
        client_pool=mock_pool,
        migration_use_case=MagicMock(),
        broadcaster=MagicMock(),
    )

    binding = ChannelSyncBinding(
        source_channel_id=-1003954412662,
        target_channel_id=-1004337257363,
        source_channel_title="La aldea del cacique",
        source_account_id=1,
        is_active=False,
    )
    binding.status = "ACCESS_REVOKED"
    binding.last_error = "Fuiste expulsado"
    await repo.save_sync_binding(binding)

    updated = await service.switch_binding_account(
        source_channel_id=-1003954412662,
        target_channel_id=-1004337257363,
        new_account_id=2,
    )

    assert updated.source_account_id == 2
    assert updated.status == "ACTIVE"
    assert updated.is_active is True
    assert updated.last_error is None

    # Check persistence
    persisted = await repo.get_sync_binding(-1003954412662, -1004337257363)
    assert persisted is not None
    assert persisted.source_account_id == 2
    assert persisted.status == "ACTIVE"
    assert persisted.is_active is True
    assert persisted.last_error is None

    await repo.close()


@pytest.mark.asyncio
async def test_live_sync_switch_binding_account_rejected_if_inaccessible():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_client2 = AsyncMock()
    mock_client2.is_connected = MagicMock(return_value=True)
    mock_client2.get_input_entity = AsyncMock(
        side_effect=ValueError("Could not find the input entity for PeerChannel")
    )

    mock_pool = MagicMock()
    mock_pool.get_client.return_value = mock_client2

    service = LiveSyncService(
        job_repository=repo,
        client_pool=mock_pool,
        migration_use_case=MagicMock(),
        broadcaster=MagicMock(),
    )

    binding = ChannelSyncBinding(
        source_channel_id=-1003954412662,
        target_channel_id=-1004337257363,
        source_channel_title="La aldea del cacique",
        source_account_id=1,
        is_active=False,
    )
    binding.status = "ACCESS_REVOKED"
    binding.last_error = "Fuiste expulsado"
    await repo.save_sync_binding(binding)

    with pytest.raises(PermissionError) as exc_info:
        await service.switch_binding_account(
            source_channel_id=-1003954412662,
            target_channel_id=-1004337257363,
            new_account_id=2,
        )

    assert "no tiene acceso" in str(exc_info.value).lower()

    # Verify original state wasn't overwritten
    persisted = await repo.get_sync_binding(-1003954412662, -1004337257363)
    assert persisted.source_account_id == 1
    assert persisted.status == "ACCESS_REVOKED"

    await repo.close()

