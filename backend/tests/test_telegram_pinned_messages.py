from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

from backend.domain.entities.chat_message import ChatMessage
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.presentation.dependencies import get_telegram_gateway
from backend.main import app


@pytest.mark.asyncio
async def test_get_pinned_chat_message_endpoint():
    mock_gw = AsyncMock(spec=TelegramGatewayPort)
    mock_pinned = [
        ChatMessage(
            id=555,
            chat_id=12345,
            sender_id=1,
            sender_name="Canal Oficial",
            text="📌 Mensaje fijado importante",
            date="12:00",
            is_outgoing=False,
            media_type=None,
            is_read=True,
        )
    ]
    mock_gw.get_pinned_messages.return_value = mock_pinned

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gw

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/dialogs/12345/pinned")
            assert res.status_code == 200
            data = res.json()
            assert data is not None
            assert data["id"] == 555
            assert "Mensaje fijado importante" in data["text"]
            mock_gw.get_pinned_messages.assert_awaited_once_with(12345, limit=1, account_id=None)
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_pin_and_unpin_chat_message_endpoints():
    mock_gw = AsyncMock(spec=TelegramGatewayPort)
    mock_gw.pin_chat_message.return_value = True
    mock_gw.unpin_chat_message.return_value = True
    mock_gw.get_chat_messages.return_value = [
        ChatMessage(
            id=777,
            chat_id=12345,
            sender_id=1,
            sender_name="Canal Oficial",
            text="Reglas de la comunidad",
            date="14:00",
            is_outgoing=True,
            media_type="photo",
            is_read=True,
        )
    ]

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gw

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Pin message
            pin_res = await client.post(
                "/api/dialogs/12345/messages/777/pin",
                json={"notify": False, "account_id": 2},
            )
            assert pin_res.status_code == 200
            pin_data = pin_res.json()
            assert pin_data["id"] == 777
            assert pin_data["text"] == "Reglas de la comunidad"
            mock_gw.pin_chat_message.assert_awaited_once_with(12345, 777, notify=False, account_id=2)

            # Unpin message
            unpin_res = await client.delete("/api/dialogs/12345/messages/777/pin?account_id=2")
            assert unpin_res.status_code == 200
            unpin_data = unpin_res.json()
            assert unpin_data["success"] is True
            assert unpin_data["message_id"] == 777
            mock_gw.unpin_chat_message.assert_awaited_once_with(12345, 777, account_id=2)
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
