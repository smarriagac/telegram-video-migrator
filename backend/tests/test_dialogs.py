from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock

from backend.domain.entities.dialog import TelegramDialog
from backend.domain.entities.chat_message import ChatMessage
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.application.use_cases.get_dialogs_use_case import GetDialogsUseCase
from backend.application.use_cases.get_chat_messages_use_case import GetChatMessagesUseCase
from backend.main import app


@pytest.mark.asyncio
async def test_get_dialogs_use_case():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.get_dialogs.return_value = [
        TelegramDialog(
            id=101,
            title="Chat de Prueba",
            type="user",
            unread_count=1,
            last_message="Hola test",
            last_message_date="14:00",
            avatar_color="bg-cyan-500",
        )
    ]

    use_case = GetDialogsUseCase(telegram_gateway=mock_gateway)
    result = await use_case.execute(limit=10)

    assert len(result) == 1
    assert result[0].id == 101
    assert result[0].title == "Chat de Prueba"
    mock_gateway.get_dialogs.assert_awaited_once_with(limit=10)


@pytest.mark.asyncio
async def test_get_chat_messages_use_case():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.get_chat_messages.return_value = [
        ChatMessage(
            id=1,
            chat_id=101,
            sender_id=200,
            sender_name="Sender",
            text="Mensaje test",
            date="14:01",
            is_outgoing=False,
        )
    ]

    use_case = GetChatMessagesUseCase(telegram_gateway=mock_gateway)
    result = await use_case.execute(chat_id=101, limit=20)

    assert len(result) == 1
    assert result[0].id == 1
    assert result[0].text == "Mensaje test"
    mock_gateway.get_chat_messages.assert_awaited_once_with(chat_id=101, limit=20)


@pytest.mark.asyncio
async def test_dialogs_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test GET /api/dialogs
        res = await client.get("/api/dialogs")
        assert res.status_code == 200
        dialogs = res.json()
        assert isinstance(dialogs, list)
        assert len(dialogs) >= 1
        assert "id" in dialogs[0]
        assert "title" in dialogs[0]

        # Test GET /api/dialogs/{chat_id}/messages
        chat_id = dialogs[0]["id"]
        msg_res = await client.get(f"/api/dialogs/{chat_id}/messages")
        assert msg_res.status_code == 200
        messages = msg_res.json()
        assert isinstance(messages, list)
