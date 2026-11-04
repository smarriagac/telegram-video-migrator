import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock

from backend.main import app
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.presentation.dependencies import get_telegram_gateway
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter


@pytest.mark.asyncio
async def test_broadcast_endpoint_validation_requires_targets():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Empty target_ids
        res = await client.post(
            "/api/channels/broadcast",
            data={"target_ids": "", "text": "Mensaje promocional #test"},
        )
        assert res.status_code == 400
        assert "especificar al menos un canal" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_broadcast_endpoint_validation_requires_content():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # No text and no files
        res = await client.post(
            "/api/channels/broadcast",
            data={"target_ids": "-100111,-100222", "text": "   "},
        )
        assert res.status_code == 400
        assert "texto o al menos un archivo" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_broadcast_endpoint_text_success():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.broadcast_message.return_value = {
        "total_targets": 2,
        "successful_count": 2,
        "failed_count": 0,
        "results": [
            {"target_id": -100111, "message_id": 501, "status": "success", "error": None},
            {"target_id": -100222, "message_id": 502, "status": "success", "error": None},
        ],
    }

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/broadcast",
                data={
                    "target_ids": "-100111, -100222",
                    "text": "Nuevo sorteo VIP! #sorteo #promocion",
                },
            )
            assert res.status_code == 201
            body = res.json()
            assert body["status"] == "success"
            assert body["total_targets"] == 2
            assert body["successful_count"] == 2
            assert body["failed_count"] == 0
            assert len(body["results"]) == 2
            assert body["results"][0]["target_id"] == -100111
            assert body["results"][0]["message_id"] == 501

            mock_gateway.broadcast_message.assert_awaited_once()
            call_kwargs = mock_gateway.broadcast_message.await_args.kwargs
            assert call_kwargs["target_ids"] == [-100111, -100222]
            assert "Nuevo sorteo VIP" in call_kwargs["text"]
            assert call_kwargs["media_paths"] is None
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_broadcast_endpoint_album_media_success():
    mock_gateway = AsyncMock(spec=TelegramGatewayPort)
    mock_gateway.broadcast_message.return_value = {
        "total_targets": 2,
        "successful_count": 2,
        "failed_count": 0,
        "results": [
            {"target_id": -100111, "message_id": 901, "status": "success", "error": None},
            {"target_id": -100222, "message_id": 902, "status": "success", "error": None},
        ],
    }

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            files = [
                ("files", ("photo1.jpg", b"fake photo 1 bytes", "image/jpeg")),
                ("files", ("video.mp4", b"fake video bytes", "video/mp4")),
            ]
            res = await client.post(
                "/api/channels/broadcast",
                data={
                    "target_ids": "[-100111, -100222]",
                    "text": "Galería exclusiva #vip",
                },
                files=files,
            )
            assert res.status_code == 201
            body = res.json()
            assert body["successful_count"] == 2
            mock_gateway.broadcast_message.assert_awaited_once()
            call_kwargs = mock_gateway.broadcast_message.await_args.kwargs
            assert len(call_kwargs["media_paths"]) == 2
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_telethon_adapter_broadcast_unit():
    mock_client = AsyncMock()
    mock_client.is_connected.return_value = True
    mock_client.is_user_authorized.return_value = True

    # Mock send_message response
    mock_msg = MagicMock()
    mock_msg.id = 777
    mock_client.send_message.return_value = mock_msg

    # Mock entity
    mock_entity = MagicMock()
    mock_client.get_input_entity.return_value = mock_entity

    adapter = TelethonAdapter(client=mock_client)
    res = await adapter.broadcast_message(
        target_ids=[-100101, -100102],
        text="Aviso de mantenimiento #update",
        media_paths=None,
        delay_seconds=0.0,
    )

    assert res["total_targets"] == 2
    assert res["successful_count"] == 2
    assert res["failed_count"] == 0
    assert len(res["results"]) == 2
    assert res["results"][0]["message_id"] == 777
    assert mock_client.send_message.await_count == 2
