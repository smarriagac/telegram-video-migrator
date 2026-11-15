from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter
from backend.presentation.dependencies import get_telegram_gateway
from backend.main import app


@pytest.mark.asyncio
async def test_extract_chat_hashtags_discovery():
    mock_client = AsyncMock()
    mock_client.is_connected.return_value = True

    m1 = MagicMock(id=101, message="Disfruta de #Netflix y #Series de estreno")
    m1.rich_message = None
    m1.action = None
    m1.media = None

    m2 = MagicMock(id=102, message="Promoción especial de #Netflix 4K con #Oferta")
    m2.rich_message = None
    m2.action = None
    m2.media = None

    m3 = MagicMock(id=103, message="Nuevo catálogo de #Anime en la tienda")
    m3.rich_message = None
    m3.action = None
    m3.media = None

    async def mock_iter(*args, **kwargs):
        for msg in [m1, m2, m3]:
            yield msg

    mock_client.iter_messages = mock_iter

    adapter = TelethonAdapter(client=mock_client)
    res = await adapter.extract_chat_hashtags(chat_id=123, limit=10)

    assert res["success"] is True
    assert res["total_hashtags"] == 4
    tags = {h["tag"]: h["count"] for h in res["hashtags"]}
    assert tags["#Netflix"] == 2
    assert tags["#Series"] == 1
    assert tags["#Oferta"] == 1
    assert tags["#Anime"] == 1
    assert "📌 **ÍNDICE DE ETIQUETAS Y CONTENIDO**" in res["suggested_message"]
    assert "#Netflix" in res["suggested_message"]


@pytest.mark.asyncio
async def test_get_chat_messages_with_search_query():
    mock_client = AsyncMock()
    mock_client.is_connected.return_value = True

    m1 = MagicMock(id=201, message="Mensaje con #Netflix", sender=None, post=True, date=None, out=False, video=None, photo=None, document=None, reply_markup=None, sender_id=1)
    m1.rich_message = None
    m1.action = None
    m1.media = None

    passed_kwargs = {}

    def mock_iter(*args, **kwargs):
        passed_kwargs.update(kwargs)
        async def gen():
            yield m1
        return gen()

    mock_client.iter_messages = mock_iter
    mock_client.iter_dialogs = MagicMock(return_value=AsyncMock(__aiter__=lambda self: self, __anext__=AsyncMock(side_effect=StopAsyncIteration))())

    adapter = TelethonAdapter(client=mock_client)
    msgs = await adapter.get_chat_messages(chat_id=123, limit=50, search_query="#Netflix")

    assert len(msgs) == 1
    assert passed_kwargs.get("search") == "#Netflix"


@pytest.mark.asyncio
async def test_get_chat_hashtags_endpoint():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.extract_chat_hashtags.return_value = {
        "success": True,
        "chat_id": 12345,
        "total_hashtags": 2,
        "hashtags": [
            {"tag": "#Netflix", "count": 10, "sample_message_ids": [10, 20]},
            {"tag": "#Disney", "count": 5, "sample_message_ids": [15, 25]},
        ],
        "suggested_message": "📌 ÍNDICE\n🔹 #Netflix\n🔹 #Disney",
    }

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/dialogs/12345/hashtags")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["total_hashtags"] == 2
            assert data["hashtags"][0]["tag"] == "#Netflix"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
