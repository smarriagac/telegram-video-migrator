from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.presentation.dependencies import get_telegram_gateway
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter


class DummyAlbumGateway:
    def __init__(self):
        self.published_albums: list[dict] = []

    async def send_media_album(
        self,
        target_channel_id: int,
        source_channel_id: int,
        message_ids: list[int],
        caption: str,
        account_id: int | None = None,
        schedule_date: Any = None,
    ) -> list[int]:
        if len(message_ids) < 2:
            raise ValueError("Telegram albums require at least 2 media items.")
        if len(message_ids) > 10:
            raise ValueError("Telegram albums allow a maximum of 10 media items.")

        self.published_albums.append({
            "target_channel_id": target_channel_id,
            "source_channel_id": source_channel_id,
            "message_ids": message_ids,
            "caption": caption,
            "account_id": account_id,
            "schedule_date": schedule_date,
        })
        # Return mock sent IDs in target channel
        return [8000 + idx for idx in range(len(message_ids))]


@pytest.mark.asyncio
async def test_publish_album_endpoint_success():
    gateway = DummyAlbumGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/-100123/publish-album",
                json={
                    "target_channel_id": -100456,
                    "message_ids": [101, 102, 103],
                    "caption": "#ejemplo1 Videos y fotos del evento",
                },
            )
            assert res.status_code == 201
            data = res.json()
            assert data["status"] == "success"
            assert data["source_channel_id"] == -100123
            assert data["target_channel_id"] == -100456
            assert len(data["sent_message_ids"]) == 3
            assert data["caption"] == "#ejemplo1 Videos y fotos del evento"
            assert not data["is_scheduled"]

            assert len(gateway.published_albums) == 1
            album = gateway.published_albums[0]
            assert album["message_ids"] == [101, 102, 103]
            assert album["caption"] == "#ejemplo1 Videos y fotos del evento"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_publish_album_endpoint_rejects_insufficient_media():
    gateway = DummyAlbumGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/-100123/publish-album",
                json={
                    "target_channel_id": -100456,
                    "message_ids": [101],
                    "caption": "#ejemplo1 Solo uno",
                },
            )
            assert res.status_code == 400
            assert "al menos 2" in res.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_publish_album_endpoint_rejects_overflow_media():
    gateway = DummyAlbumGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/-100123/publish-album",
                json={
                    "target_channel_id": -100456,
                    "message_ids": list(range(1, 12)),  # 11 items
                    "caption": "#ejemplo1 Demasiados",
                },
            )
            assert res.status_code == 400
            assert "máximo de 10" in res.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_publish_album_endpoint_supports_same_source_target():
    gateway = DummyAlbumGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/-100123/publish-album",
                json={
                    "target_channel_id": -100123,
                    "message_ids": [101, 102],
                    "caption": "#ejemplo1 Mismo canal",
                },
            )
            assert res.status_code == 201
            assert res.json()["source_channel_id"] == -100123
            assert res.json()["target_channel_id"] == -100123
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_telethon_adapter_send_media_album_unit():
    mock_client = AsyncMock()
    adapter = TelethonAdapter(client=mock_client)

    # 1. Bounds checks
    with pytest.raises(ValueError, match="at least 2"):
        await adapter.send_media_album(
            target_channel_id=200,
            source_channel_id=100,
            message_ids=[1],
            caption="#test",
        )

    with pytest.raises(ValueError, match="maximum of 10"):
        await adapter.send_media_album(
            target_channel_id=200,
            source_channel_id=100,
            message_ids=list(range(12)),
            caption="#test",
        )

    # 2. Mock client execution
    mock_client = AsyncMock()
    adapter._get_client = MagicMock(return_value=mock_client)
    adapter._ensure_connected = AsyncMock()

    # Fake message objects with media
    msg1 = MagicMock(id=10, media=MagicMock())
    msg2 = MagicMock(id=11, media=MagicMock())
    msg3 = MagicMock(id=12, media=MagicMock())
    mock_client.get_messages.return_value = [msg1, msg2, msg3]

    # Fake sent messages in target channel
    sent1 = MagicMock(id=901)
    sent2 = MagicMock(id=902)
    sent3 = MagicMock(id=903)
    mock_client.send_file.return_value = [sent1, sent2, sent3]

    result = await adapter.send_media_album(
        target_channel_id=-100200,
        source_channel_id=-100100,
        message_ids=[10, 11, 12],
        caption="#ejemplo1 Pack de fotos",
    )

    assert result == [901, 902, 903]
    mock_client.get_messages.assert_called_once_with(-100100, ids=[10, 11, 12])
    mock_client.send_file.assert_called_once_with(
        -100200,
        file=[msg1, msg2, msg3],
        caption="#ejemplo1 Pack de fotos",
        schedule=None,
    )
