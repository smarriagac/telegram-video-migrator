from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter
from backend.presentation.dependencies import get_telegram_gateway
from backend.main import app


@pytest.mark.asyncio
async def test_adapter_open_bot_start():
    mock_client = AsyncMock()
    mock_client.is_connected.return_value = True

    mock_entity = MagicMock()
    mock_entity.id = 8821883335
    mock_entity.title = "Asha Store"
    mock_entity.username = "ashasstorebot"

    mock_sent_msg = MagicMock()
    mock_sent_msg.id = 5544

    mock_client.get_entity.return_value = mock_entity
    mock_client.send_message.return_value = mock_sent_msg

    adapter = TelethonAdapter(client=mock_client)
    res = await adapter.open_bot_start("ashasstorebot", start_param="Y3YyOjgw")

    assert res["success"] is True
    assert res["chat_id"] == 8821883335
    assert res["chat_username"] == "ashasstorebot"
    assert res["sent_message_id"] == 5544
    mock_client.send_message.assert_awaited_once_with(mock_entity, "/start Y3YyOjgw")


@pytest.mark.asyncio
async def test_open_bot_endpoint():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.open_bot_start.return_value = {
        "success": True,
        "chat_id": 8821883335,
        "chat_title": "Asha Store",
        "chat_username": "ashasstorebot",
        "sent_message_id": 5544,
    }

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/dialogs/open-bot",
                json={"bot_username": "ashasstorebot", "start_param": "Y3YyOjgw"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["chat_id"] == 8821883335
            assert data["chat_username"] == "ashasstorebot"

            mock_gateway.open_bot_start.assert_awaited_once_with(
                bot_username="ashasstorebot",
                start_param="Y3YyOjgw",
                account_id=None,
            )
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
