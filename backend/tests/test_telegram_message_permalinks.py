from __future__ import annotations

from datetime import datetime
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter
from backend.presentation.dependencies import get_telegram_gateway
from backend.main import app


def test_parse_message_link_formats():
    adapter = TelethonAdapter(client=AsyncMock())

    # Public channel / chat
    assert adapter._parse_message_link("https://t.me/tevsosb/1332") == ("public_chat", "tevsosb", 1332)
    assert adapter._parse_message_link("http://t.me/tevsosb/1332") == ("public_chat", "tevsosb", 1332)
    assert adapter._parse_message_link("t.me/tevsosb/1332") == ("public_chat", "tevsosb", 1332)
    assert adapter._parse_message_link("https://t.me/tevsosb/1332?single") == ("public_chat", "tevsosb", 1332)
    assert adapter._parse_message_link("@tevsosb/1332") == ("public_chat", "tevsosb", 1332)

    # Private channel / supergroup
    assert adapter._parse_message_link("https://t.me/c/1234567890/1332") == ("private_channel", 1234567890, 1332)
    assert adapter._parse_message_link("t.me/c/987654321/55") == ("private_channel", 987654321, 55)

    # Invalid / generic invites
    assert adapter._parse_message_link("https://t.me/+AbCdEf123") is None
    assert adapter._parse_message_link("https://t.me/just_channel") is None
    assert adapter._parse_message_link("random text") is None


@pytest.mark.asyncio
async def test_adapter_resolve_message_link_success():
    mock_client = AsyncMock()
    mock_client.is_connected.return_value = True

    mock_entity = MagicMock()
    mock_entity.id = 1234567890
    mock_entity.title = "Canal Oficial"
    mock_entity.username = "tevsosb"
    mock_entity.broadcast = True

    mock_message = MagicMock()
    mock_message.id = 1332
    mock_message.sender = None
    mock_message.post = True
    mock_message.message = "Imagen del día con caption increíble"
    mock_message.date = datetime(2026, 11, 14, 15, 30)
    mock_message.out = False
    mock_message.video = None
    mock_message.photo = MagicMock()
    mock_message.document = None
    mock_message.reply_markup = None

    mock_client.get_entity.return_value = mock_entity
    mock_client.get_messages.return_value = mock_message

    adapter = TelethonAdapter(client=mock_client)
    res = await adapter.resolve_message_link("https://t.me/tevsosb/1332")

    assert res["success"] is True
    assert res["chat_id"] == -1001234567890
    assert res["chat_title"] == "Canal Oficial"
    assert res["chat_username"] == "tevsosb"
    assert res["message_id"] == 1332
    assert res["message"]["text"] == "Imagen del día con caption increíble"
    assert res["message"]["media_type"] == "photo"


@pytest.mark.asyncio
async def test_resolve_message_link_endpoint():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.resolve_message_link.return_value = {
        "success": True,
        "chat_id": -1001234567890,
        "chat_title": "Canal Oficial",
        "chat_username": "tevsosb",
        "message_id": 1332,
        "message": {
            "id": 1332,
            "sender": "Canal",
            "text": "Foto destacada",
            "date": "15:30",
            "is_outgoing": False,
            "is_read": True,
            "media_type": "photo",
            "buttons": None,
        },
    }

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/dialogs/resolve-message-link",
                json={"url": "https://t.me/tevsosb/1332"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["chat_id"] == -1001234567890
            assert data["message_id"] == 1332
            assert data["message"]["media_type"] == "photo"

            mock_gateway.resolve_message_link.assert_awaited_once_with(
                "https://t.me/tevsosb/1332",
                account_id=None,
            )
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
