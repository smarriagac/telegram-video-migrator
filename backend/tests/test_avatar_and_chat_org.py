from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.presentation.dependencies import get_telegram_gateway
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter


class DummyAvatarGateway:
    def __init__(self):
        self.avatars: dict[int, bytes | None] = {
            123: b"\xff\xd8\xff\xe0fake-jpeg-avatar-bytes",
            456: None,
        }

    async def get_entity_avatar(
        self, entity_id: int, account_id: int | None = None
    ) -> bytes | None:
        return self.avatars.get(entity_id)


@pytest.mark.asyncio
async def test_dialog_avatar_endpoint_success():
    gateway = DummyAvatarGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/dialogs/123/avatar")
            assert res.status_code == 200
            assert res.headers["content-type"] == "image/jpeg"
            assert res.content == b"\xff\xd8\xff\xe0fake-jpeg-avatar-bytes"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_dialog_avatar_endpoint_404():
    gateway = DummyAvatarGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/dialogs/456/avatar")
            assert res.status_code == 404
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_channel_avatar_endpoint_success():
    gateway = DummyAvatarGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/channels/123/avatar")
            assert res.status_code == 200
            assert res.headers["content-type"] == "image/jpeg"
            assert res.content == b"\xff\xd8\xff\xe0fake-jpeg-avatar-bytes"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_telethon_adapter_get_entity_avatar_caching():
    mock_client = AsyncMock()
    adapter = TelethonAdapter(client=mock_client)

    fake_entity = MagicMock(photo=MagicMock())
    mock_client.get_entity.return_value = fake_entity
    mock_client.download_profile_photo.return_value = b"photo-bytes"

    # First call - loads from client
    res1 = await adapter.get_entity_avatar(789)
    assert res1 == b"photo-bytes"
    mock_client.get_entity.assert_called_once_with(789)
    mock_client.download_profile_photo.assert_called_once()

    # Second call - returns from in-memory cache
    mock_client.get_entity.reset_mock()
    mock_client.download_profile_photo.reset_mock()
    res2 = await adapter.get_entity_avatar(789)
    assert res2 == b"photo-bytes"
    mock_client.get_entity.assert_not_called()
    mock_client.download_profile_photo.assert_not_called()
