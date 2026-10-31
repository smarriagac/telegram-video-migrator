from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.domain.entities.channel_message import ChannelMessage
from backend.presentation.dependencies import get_telegram_gateway


class DummyGatewayWithMessages:
    async def get_channel_messages(
        self, channel_id: int, limit: int = 50, offset_id: int | None = None
    ) -> list[ChannelMessage]:
        return [
            ChannelMessage(
                id=101,
                channel_id=channel_id,
                text="Video tutorial intro",
                media_type="video",
                date="2026-10-30 15:30",
                file_size=10485760,
                views=150,
            ),
            ChannelMessage(
                id=102,
                channel_id=channel_id,
                text="Promotional photo",
                media_type="photo",
                date="2026-10-30 16:00",
                file_size=204800,
                views=80,
            ),
            ChannelMessage(
                id=103,
                channel_id=channel_id,
                text="Just a plain text announcement",
                media_type="text",
                date="2026-10-30 16:15",
                file_size=None,
                views=220,
            ),
        ]


@pytest.mark.asyncio
async def test_get_channel_messages_endpoint():
    app.dependency_overrides[get_telegram_gateway] = lambda: DummyGatewayWithMessages()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/channels/-1001952562635/messages?limit=10")
            assert res.status_code == 200
            data = res.json()
            assert isinstance(data, list)
            assert len(data) == 3
            assert data[0]["id"] == 101
            assert data[0]["media_type"] == "video"
            assert data[0]["file_size"] == 10485760
            assert data[1]["media_type"] == "photo"
            assert data[2]["media_type"] == "text"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
