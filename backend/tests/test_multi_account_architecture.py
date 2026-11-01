from __future__ import annotations

import pytest
from backend.domain.entities.telegram_account import TelegramAccount
from backend.domain.entities.channel import Channel
from backend.infrastructure.persistence.postgres_repository import PostgresRepository
from backend.infrastructure.security.fernet_encryption_service import FernetEncryptionService


@pytest.mark.asyncio
async def test_telegram_accounts_repository_multi_account():
    repo = PostgresRepository()
    await repo.initialize_schema()
    enc_svc = FernetEncryptionService()

    # Create Account A
    acc_a = await repo.save_account(
        TelegramAccount(
            id=None,
            name="Cuenta Test A",
            phone="+111111111",
            api_id_encrypted=enc_svc.encrypt("11111"),
            api_hash_encrypted=enc_svc.encrypt("hash_a"),
            session_string_encrypted=enc_svc.encrypt("session_a"),
            is_active=True,
        )
    )
    assert acc_a.id is not None
    assert acc_a.is_active is True

    # Create Account B (both should remain active in multi-account mode)
    acc_b = await repo.save_account(
        TelegramAccount(
            id=None,
            name="Cuenta Test B",
            phone="+222222222",
            api_id_encrypted=enc_svc.encrypt("22222"),
            api_hash_encrypted=enc_svc.encrypt("hash_b"),
            session_string_encrypted=enc_svc.encrypt("session_b"),
            is_active=True,
        )
    )
    assert acc_b.id is not None
    assert acc_b.is_active is True

    # Verify list_active_accounts returns both
    active_accounts = await repo.list_active_accounts()
    active_ids = [a.id for a in active_accounts]
    assert acc_a.id in active_ids
    assert acc_b.id in active_ids

    # Verify get_account_by_id
    fetched_a = await repo.get_account_by_id(acc_a.id)
    assert fetched_a is not None
    assert fetched_a.name == "Cuenta Test A"

    # Verify delete_account
    deleted = await repo.delete_account(acc_a.id)
    assert deleted is True
    assert await repo.get_account_by_id(acc_a.id) is None

    # Clean up Account B
    await repo.delete_account(acc_b.id)


def test_channel_entity_multi_account_fields():
    ch = Channel(
        id=-1001234567,
        title="Canal VIP",
        username="canal_vip",
        can_post=True,
        account_id=1,
        account_name="Cuenta Principal",
    )
    assert ch.account_id == 1
    assert ch.account_name == "Cuenta Principal"


def test_telegram_client_pool():
    from backend.infrastructure.telegram.telegram_client_pool import TelegramClientPool
    from unittest.mock import MagicMock

    pool = TelegramClientPool()
    client_a = MagicMock()
    client_b = MagicMock()

    pool.register_client(account_id=1, account_name="Principal", client=client_a, is_default=True)
    pool.register_client(account_id=2, account_name="Secundaria", client=client_b)

    assert pool.get_client(1) is client_a
    assert pool.get_client(2) is client_b
    assert pool.get_client(None) is client_a  # Default fallback
    assert len(pool.list_clients()) == 2
    assert pool.get_account_name(2) == "Secundaria"

    pool.remove_client(2)
    assert pool.get_client(2) is client_a  # Fallback to default
    assert len(pool.list_clients()) == 1


@pytest.mark.asyncio
async def test_telethon_adapter_multi_account_channels():
    from backend.infrastructure.telegram.telegram_client_pool import TelegramClientPool
    from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter
    from unittest.mock import AsyncMock, MagicMock

    pool = TelegramClientPool()

    # Mock Client A
    client_a = MagicMock()
    client_a.is_connected = MagicMock(return_value=True)
    client_a.is_user_authorized = AsyncMock(return_value=True)
    dialog_a = MagicMock()
    dialog_a.is_channel = True
    dialog_a.id = -100111
    dialog_a.name = "Canal Cuenta A"
    dialog_a.entity = MagicMock(creator=True)
    client_a.get_dialogs = AsyncMock(return_value=[dialog_a])

    # Mock Client B
    client_b = MagicMock()
    client_b.is_connected = MagicMock(return_value=True)
    client_b.is_user_authorized = AsyncMock(return_value=True)
    dialog_b = MagicMock()
    dialog_b.is_channel = True
    dialog_b.id = -100222
    dialog_b.name = "Canal Cuenta B"
    dialog_b.entity = MagicMock(creator=False, admin_rights=MagicMock(post_messages=True))
    client_b.get_dialogs = AsyncMock(return_value=[dialog_b])

    pool.register_client(1, "Cuenta A", client_a, is_default=True)
    pool.register_client(2, "Cuenta B", client_b)

    adapter = TelethonAdapter(client=client_a, pool=pool)

    # 1. Fetching channels for specific account
    channels_a = await adapter.get_managed_channels(account_id=1)
    assert len(channels_a) == 1
    assert channels_a[0].id == -100111
    assert channels_a[0].account_id == 1
    assert channels_a[0].account_name == "Cuenta A"

    # 2. Fetching channels across all accounts
    all_channels = await adapter.get_managed_channels()
    assert len(all_channels) == 2
    acc_ids = {c.account_id for c in all_channels}
    assert 1 in acc_ids
    assert 2 in acc_ids


@pytest.mark.asyncio
async def test_telethon_adapter_copy_media_cross_account():
    from backend.infrastructure.telegram.telegram_client_pool import TelegramClientPool
    from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter
    from backend.domain.entities.video_message import VideoMessage
    from unittest.mock import AsyncMock, MagicMock
    import os

    pool = TelegramClientPool()

    client_a = MagicMock()
    client_a.is_connected = MagicMock(return_value=True)
    client_a.is_user_authorized = AsyncMock(return_value=True)

    # Mock source message with media
    mock_src_msg = MagicMock()
    mock_src_msg.media = MagicMock()
    client_a.get_messages = AsyncMock(return_value=mock_src_msg)

    async def fake_download(msg, file):
        with open(file, "wb") as f:
            f.write(b"fake video data")
        return file

    client_a.download_media = AsyncMock(side_effect=fake_download)

    client_b = MagicMock()
    client_b.is_connected = MagicMock(return_value=True)
    client_b.is_user_authorized = AsyncMock(return_value=True)
    mock_sent = MagicMock()
    mock_sent.id = 8888
    client_b.send_file = AsyncMock(return_value=mock_sent)
    client_b.send_message = AsyncMock(return_value=mock_sent)

    pool.register_client(1, "Cuenta A", client_a, is_default=True)
    pool.register_client(2, "Cuenta B", client_b)

    adapter = TelethonAdapter(client=client_a, pool=pool)

    # Test 1: Cross-account media transfer (A -> B)
    video = VideoMessage(
        message_id=101,
        source_channel_id=-100111,
        caption="Video cross account",
        media_type="video",
        input_document_id=999,
        access_hash=888,
        file_reference=b"ref",
    )

    new_msg_id = await adapter.copy_media_cross_account(
        source_channel_id=-100111,
        target_channel_id=-100222,
        video=video,
        source_account_id=1,
        target_account_id=2,
    )

    assert new_msg_id == 8888
    client_a.get_messages.assert_called_once_with(-100111, ids=101)
    client_b.send_file.assert_called_once()
    call_args = client_b.send_file.call_args[1]
    assert call_args["caption"] == "Video cross account"

    # Test 2: Cross-account text transfer (A -> B)
    text_msg = VideoMessage(
        message_id=102,
        source_channel_id=-100111,
        caption="Texto cross account",
        media_type="text",
    )

    text_id = await adapter.copy_media_cross_account(
        source_channel_id=-100111,
        target_channel_id=-100222,
        video=text_msg,
        source_account_id=1,
        target_account_id=2,
    )
    assert text_id == 8888
    client_b.send_message.assert_called_once()


@pytest.mark.asyncio
async def test_clone_channel_videos_use_case_dual_routing():
    from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase
    from backend.domain.entities.migration_job import MigrationJob, JobStatus
    from backend.domain.entities.video_message import VideoMessage
    from unittest.mock import AsyncMock, MagicMock

    gateway = MagicMock()
    repo = MagicMock()

    job_same_acc = MigrationJob(
        job_id="job_same",
        source_id=-100111,
        target_id=-100222,
        source_account_id=1,
        target_account_id=1,
    )
    job_cross_acc = MigrationJob(
        job_id="job_cross",
        source_id=-100111,
        target_id=-100333,
        source_account_id=1,
        target_account_id=2,
    )

    sample_video = VideoMessage(
        message_id=50,
        source_channel_id=-100111,
        caption="Sample test video",
        media_type="video",
    )

    use_case = CloneChannelVideosUseCase(
        telegram_gateway=gateway,
        job_repository=repo,
        min_delay_seconds=0.01,
        max_delay_seconds=0.01,
    )

    # Fast path: same account -> copy_video_by_reference
    repo.get_job = AsyncMock(return_value=job_same_acc)
    repo.get_queue_items = AsyncMock(return_value=[])
    gateway.fetch_channel_videos = AsyncMock(return_value=[sample_video])
    repo.add_queue_items = AsyncMock()
    repo.create_job = AsyncMock()
    repo.set_job_status = AsyncMock()
    mock_item = MagicMock()
    mock_item.source_message_id = 50
    mock_item.caption = "Sample test video"
    mock_item.media_type = "video"
    repo.get_next_pending_queue_item = AsyncMock(side_effect=[mock_item, None])
    repo.is_item_migrated = AsyncMock(return_value=False)
    repo.update_queue_item_status = AsyncMock()
    repo.record_migrated_item = AsyncMock()
    repo.get_queue_stats = AsyncMock(return_value={"completed": 1, "failed": 0, "skipped": 0})
    repo.update_job_progress = AsyncMock()
    gateway.copy_video_by_reference = AsyncMock(return_value=9991)
    gateway.copy_media_cross_account = AsyncMock(return_value=9992)

    await use_case.execute("job_same")
    gateway.copy_video_by_reference.assert_called_once()
    gateway.copy_media_cross_account.assert_not_called()

    # Bridge path: cross account -> copy_media_cross_account
    gateway.copy_video_by_reference.reset_mock()
    gateway.copy_media_cross_account.reset_mock()

    repo.get_job = AsyncMock(return_value=job_cross_acc)
    repo.get_next_pending_queue_item = AsyncMock(side_effect=[mock_item, None])

    await use_case.execute("job_cross")
    gateway.copy_media_cross_account.assert_called_once()
    gateway.copy_video_by_reference.assert_not_called()




