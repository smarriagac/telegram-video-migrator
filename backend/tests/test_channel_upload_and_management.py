from __future__ import annotations

import io
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.domain.entities.channel_message import ChannelMessage
from backend.presentation.dependencies import get_telegram_gateway


class DummyManagementGateway:
    def __init__(self):
        self.uploaded_files: list[dict] = []
        self.deleted_messages: list[tuple[int, int]] = []
        self.edited_messages: list[tuple[int, int, str]] = []

    async def send_local_media(
        self, channel_id: int, file_path: str, caption: str | None = None
    ) -> ChannelMessage:
        msg_id = 9991
        self.uploaded_files.append({"channel_id": channel_id, "file_path": file_path, "caption": caption})
        return ChannelMessage(
            id=msg_id,
            channel_id=channel_id,
            text=caption or "",
            media_type="video",
            date="2026-10-31 10:00",
            file_size=1024,
        )

    async def send_text_message(
        self, channel_id: int, text: str
    ) -> ChannelMessage:
        msg_id = 9992
        return ChannelMessage(
            id=msg_id,
            channel_id=channel_id,
            text=text,
            media_type="text",
            date="2026-10-31 10:05",
        )

    async def delete_channel_message(
        self, channel_id: int, message_id: int
    ) -> bool:
        self.deleted_messages.append((channel_id, message_id))
        return True

    async def edit_channel_message(
        self, channel_id: int, message_id: int, text: str
    ) -> ChannelMessage:
        self.edited_messages.append((channel_id, message_id, text))
        return ChannelMessage(
            id=message_id,
            channel_id=channel_id,
            text=text,
            media_type="text",
            date="2026-10-31 10:10",
        )


@pytest.mark.asyncio
async def test_upload_local_media_endpoint():
    dummy = DummyManagementGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: dummy
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            files = {"file": ("test_clip.mp4", io.BytesIO(b"fake video data content"), "video/mp4")}
            data = {"caption": "Test video upload from local"}
            res = await client.post("/api/channels/-1001234567/upload", data=data, files=files)
            assert res.status_code == 201
            resp_data = res.json()
            assert resp_data["id"] == 9991
            assert resp_data["media_type"] == "video"
            assert resp_data["text"] == "Test video upload from local"
            assert len(dummy.uploaded_files) == 1
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_send_text_message_endpoint():
    dummy = DummyManagementGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: dummy
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            data = {"text": "Texto sin archivo adjunto"}
            res = await client.post("/api/channels/-1001234567/upload", data=data)
            assert res.status_code == 201
            resp_data = res.json()
            assert resp_data["id"] == 9992
            assert resp_data["media_type"] == "text"
            assert resp_data["text"] == "Texto sin archivo adjunto"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_delete_message_endpoint():
    dummy = DummyManagementGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: dummy
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.delete("/api/channels/-1001234567/messages/9991")
            assert res.status_code == 200
            assert res.json()["success"] is True
            assert (-1001234567, 9991) in dummy.deleted_messages
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_edit_message_endpoint():
    dummy = DummyManagementGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: dummy
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.patch("/api/channels/-1001234567/messages/9991", json={"text": "Nuevo texto editado"})
            assert res.status_code == 200
            data = res.json()
            assert data["id"] == 9991
            assert data["text"] == "Nuevo texto editado"
            assert (-1001234567, 9991, "Nuevo texto editado") in dummy.edited_messages
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
