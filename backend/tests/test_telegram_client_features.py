from __future__ import annotations

import io
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter
from backend.presentation.dependencies import get_telegram_gateway
from backend.main import app


def test_telethon_adapter_parse_invite_target():
    adapter = TelethonAdapter(client=AsyncMock())

    assert adapter._parse_invite_target("https://t.me/+AbCdEf123") == ("hash", "AbCdEf123")
    assert adapter._parse_invite_target("https://t.me/joinchat/XyZ_99") == ("hash", "XyZ_99")
    assert adapter._parse_invite_target("+PrivateGroupHash") == ("hash", "PrivateGroupHash")
    assert adapter._parse_invite_target("https://t.me/mi_canal_publico") == ("username", "mi_canal_publico")
    assert adapter._parse_invite_target("t.me/mi_canal_publico") == ("username", "mi_canal_publico")
    assert adapter._parse_invite_target("@mi_canal") == ("username", "mi_canal")
    assert adapter._parse_invite_target("mi_canal") == ("username", "mi_canal")


@pytest.mark.asyncio
async def test_forward_messages_endpoint():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.forward_messages.return_value = [1001, 1002]

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "message_ids": [10, 20],
                "target_chat_ids": [-100999888],
            }
            res = await client.post("/api/dialogs/101/messages/forward", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["forwarded_count"] == 2
            assert data["forwarded_message_ids"] == [1001, 1002]

            mock_gateway.forward_messages.assert_awaited_once_with(
                source_chat_id=101,
                target_chat_ids=[-100999888],
                message_ids=[10, 20],
                account_id=None,
            )
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_check_and_join_invite_endpoints():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.check_chat_invite.return_value = {
        "already_joined": False,
        "title": "Grupo Privado Exclusivo",
        "type": "group",
        "participants_count": 550,
        "about": "Comunidad privada",
        "hash": "AbCd123",
    }
    mock_gateway.join_chat_invite.return_value = {
        "success": True,
        "chat_id": -100777888,
        "title": "Grupo Privado Exclusivo",
        "already_joined": False,
    }

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Test check-invite
            check_res = await client.post(
                "/api/dialogs/check-invite",
                json={"invite_url": "https://t.me/+AbCd123"},
            )
            assert check_res.status_code == 200
            check_data = check_res.json()
            assert check_data["success"] is True
            assert check_data["invite"]["title"] == "Grupo Privado Exclusivo"
            assert check_data["invite"]["participants_count"] == 550

            # Test join-invite
            join_res = await client.post(
                "/api/dialogs/join-invite",
                json={"invite_url": "https://t.me/+AbCd123"},
            )
            assert join_res.status_code == 200
            join_data = join_res.json()
            assert join_data["success"] is True
            assert join_data["result"]["chat_id"] == -100777888
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_get_chat_full_info_endpoint():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.get_chat_full_info.return_value = {
        "id": -100123456789,
        "title": "Canal VIP Oficial",
        "username": "canal_vip_oficial",
        "type": "channel",
        "participants_count": 15400,
        "about": "Canal oficial con alertas diarias",
        "invite_link": "https://t.me/+xyz123",
        "is_creator": True,
        "is_admin": True,
        "can_change_info": True,
    }

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/dialogs/-100123456789/full-info")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["chat"]["title"] == "Canal VIP Oficial"
            assert data["chat"]["username"] == "canal_vip_oficial"
            assert data["chat"]["participants_count"] == 15400
            assert data["chat"]["can_change_info"] is True
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_update_chat_photo_endpoint():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.update_chat_photo.return_value = True

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            fake_photo = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00")
            files = {"file": ("avatar.jpg", fake_photo, "image/jpeg")}
            res = await client.post("/api/dialogs/-100123456789/photo", files=files)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["chat_id"] == -100123456789
            assert mock_gateway.update_chat_photo.await_count == 1
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
