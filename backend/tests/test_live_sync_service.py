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
