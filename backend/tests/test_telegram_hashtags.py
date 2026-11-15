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


@pytest.mark.asyncio
async def test_extract_chat_hashtags_utf16_and_emojis_sanitization():
    from telethon.tl.types import MessageEntityHashtag

    mock_client = AsyncMock()
    mock_client.is_connected.return_value = True

    # Text containing emojis which take 2 UTF-16 code units (surrogate pairs)
    # Native Telegram entity with UTF-16 offsets
    text = "Promo 🔞✨ #valledupar 🔥🔥🔥 #baba2vip y más"
    utf16_bytes = text.encode("utf-16-le")
    # find offset of #valledupar in utf-16
    val_byte_offset = utf16_bytes.find("#valledupar".encode("utf-16-le"))
    offset_units = val_byte_offset // 2
    length_units = len("#valledupar".encode("utf-16-le")) // 2

    ent = MessageEntityHashtag(offset=offset_units, length=length_units)

    msg = MagicMock(id=301, message=text, entities=[ent])
    msg.rich_message = None
    msg.action = None
    msg.media = None

    async def mock_iter(*args, **kwargs):
        yield msg

    mock_client.iter_messages = mock_iter

    adapter = TelethonAdapter(client=mock_client)
    res = await adapter.extract_chat_hashtags(chat_id=999, limit=10)

    assert res["success"] is True
    tags = {h["tag"] for h in res["hashtags"]}
    assert "#valledupar" in tags
    assert "#baba2vip" in tags
    # Ensure NO emoji or trailing garbage attached to any tag
    for t in tags:
        assert not any(char in t for char in ["🔞", "✨", "🔥", " "])


@pytest.mark.asyncio
async def test_extract_chat_hashtags_full_history_unbounded_limit():
    mock_client = AsyncMock()
    mock_client.is_connected.return_value = True

    passed_kwargs = {}

    def mock_iter(*args, **kwargs):
        passed_kwargs.update(kwargs)
        async def gen():
            if False:
                yield
        return gen()

    mock_client.iter_messages = mock_iter

    adapter = TelethonAdapter(client=mock_client)
    await adapter.extract_chat_hashtags(chat_id=888, limit=0)

    # When limit=0 or <= 0, iter_messages should be called with limit=None for full history
    assert passed_kwargs.get("limit") is None
