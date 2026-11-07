from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest

from backend.domain.entities.scheduled_broadcast import ScheduledBroadcast
from backend.application.services.broadcast_scheduler_service import BroadcastSchedulerService
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository


@pytest.mark.asyncio
async def test_scheduled_broadcast_crud():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    item = ScheduledBroadcast(
        id="test-bc-1",
        name="Campaña VIP",
        target_ids=[-100111, -100222],
        text="¡Gran sorteo exclusivo hoy!",
        media_paths=["/tmp/banner.jpg"],
        account_id=1,
        scheduled_at=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        recurrence="DAILY",
        status="SCHEDULED",
    )

    created = await repo.create_scheduled_broadcast(item)
    assert created.id == "test-bc-1"
    assert created.target_ids == [-100111, -100222]

    fetched = await repo.get_scheduled_broadcast("test-bc-1")
    assert fetched is not None
    assert fetched.name == "Campaña VIP"
    assert fetched.recurrence == "DAILY"
    assert fetched.media_paths == ["/tmp/banner.jpg"]

    # List
    all_items = await repo.list_scheduled_broadcasts()
    assert len(all_items) == 1

    # Update
    fetched.run_count = 2
    fetched.status = "COMPLETED"
    updated = await repo.update_scheduled_broadcast(fetched)
    assert updated.run_count == 2
    assert updated.status == "COMPLETED"

    # Delete
    deleted = await repo.delete_scheduled_broadcast("test-bc-1")
    assert deleted is True
    assert await repo.get_scheduled_broadcast("test-bc-1") is None

    await repo.close()


@pytest.mark.asyncio
async def test_broadcast_scheduler_one_time_execution():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_gateway = MagicMock()
    mock_gateway.broadcast_message = AsyncMock(
        return_value={"total_targets": 2, "successful_count": 2, "failed_count": 0, "results": []}
    )

    mock_broadcaster = MagicMock()
    mock_broadcaster.broadcast = AsyncMock()

    service = BroadcastSchedulerService(
        job_repo=repo,
        telegram_gateway=mock_gateway,
        broadcaster=mock_broadcaster,
    )

    # Past due broadcast
    due_dt = datetime.now(timezone.utc) - timedelta(minutes=5)
    item = ScheduledBroadcast(
        id="once-job",
        target_ids=[-100111, -100222],
        text="Aviso inmediato",
        scheduled_at=due_dt.isoformat(),
        recurrence="ONCE",
        status="SCHEDULED",
    )
    await repo.create_scheduled_broadcast(item)

    triggered = await service.check_and_trigger_scheduled_broadcasts()
    assert "once-job" in triggered
    assert mock_gateway.broadcast_message.called
    call_kwargs = mock_gateway.broadcast_message.call_args[1]
    assert call_kwargs["target_ids"] == [-100111, -100222]
    assert call_kwargs["text"] == "Aviso inmediato"

    finished = await repo.get_scheduled_broadcast("once-job")
    assert finished is not None
    assert finished.status == "COMPLETED"
    assert finished.run_count == 1
    assert finished.last_run_at is not None

    await repo.close()


@pytest.mark.asyncio
async def test_broadcast_scheduler_recurring_execution():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_gateway = MagicMock()
    mock_gateway.broadcast_message = AsyncMock(
        return_value={"total_targets": 1, "successful_count": 1, "failed_count": 0, "results": []}
    )

    service = BroadcastSchedulerService(
        job_repo=repo,
        telegram_gateway=mock_gateway,
    )

    due_dt = datetime.now(timezone.utc) - timedelta(minutes=2)
    item = ScheduledBroadcast(
        id="recurring-job",
        target_ids=[-100333],
        text="Contenido recurrente cada 6 horas",
        scheduled_at=due_dt.isoformat(),
        recurrence="EVERY_6_HOURS",
        status="SCHEDULED",
    )
    await repo.create_scheduled_broadcast(item)

    triggered = await service.check_and_trigger_scheduled_broadcasts()
    assert "recurring-job" in triggered
    assert mock_gateway.broadcast_message.called

    persisted = await repo.get_scheduled_broadcast("recurring-job")
    assert persisted is not None
    # Still scheduled for next interval!
    assert persisted.status == "SCHEDULED"
    assert persisted.run_count == 1
    # Next scheduled time must be in the future
    next_dt = datetime.fromisoformat(persisted.scheduled_at.replace("Z", "+00:00"))
    if next_dt.tzinfo is None:
        next_dt = next_dt.replace(tzinfo=timezone.utc)
    assert next_dt > datetime.now(timezone.utc)

    await repo.close()


@pytest.mark.asyncio
async def test_broadcast_scheduler_future_not_triggered():
    repo = SQLiteJobRepository(db_path=":memory:")
    await repo.initialize_schema()

    mock_gateway = MagicMock()
    mock_gateway.broadcast_message = AsyncMock()

    service = BroadcastSchedulerService(
        job_repo=repo,
        telegram_gateway=mock_gateway,
    )

    future_dt = datetime.now(timezone.utc) + timedelta(hours=3)
    item = ScheduledBroadcast(
        id="future-job",
        target_ids=[-100555],
        text="Para más tarde",
        scheduled_at=future_dt.isoformat(),
        recurrence="DAILY",
        status="SCHEDULED",
    )
    await repo.create_scheduled_broadcast(item)

    triggered = await service.check_and_trigger_scheduled_broadcasts()
    assert len(triggered) == 0
    assert not mock_gateway.broadcast_message.called

    persisted = await repo.get_scheduled_broadcast("future-job")
    assert persisted.status == "SCHEDULED"
    assert persisted.run_count == 0

    await repo.close()
