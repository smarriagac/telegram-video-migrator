from __future__ import annotations

from typing import Any
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.domain.entities.channel_message import ChannelMessage
from backend.presentation.dependencies import get_telegram_gateway


class DummySelfOrgGateway:
    def __init__(self):
        self.messages_store: dict[int, str] = {
            101: "Video tutorial parte 1",
            102: "Video tutorial parte 2",
            103: "",
        }
        self.edited_messages: list[tuple[int, int, str]] = []
        self.deleted_message_ids: list[int] = []
        self.published_albums: list[dict] = []

    async def get_messages_by_ids(
        self, channel_id: int, message_ids: list[int], account_id: int | None = None
    ) -> list[ChannelMessage]:
        result = []
        for mid in message_ids:
            if mid in self.messages_store:
                result.append(
                    ChannelMessage(
                        id=mid,
                        channel_id=channel_id,
                        text=self.messages_store[mid],
                        media_type="video",
                        date="2026-11-03 10:00",
                    )
                )
        return result

    async def edit_channel_message(
        self, channel_id: int, message_id: int, text: str
    ) -> ChannelMessage:
        self.edited_messages.append((channel_id, message_id, text))
        self.messages_store[message_id] = text
        return ChannelMessage(
            id=message_id,
            channel_id=channel_id,
            text=text,
            media_type="video",
            date="2026-11-03 10:00",
        )

    async def delete_channel_messages(
        self, channel_id: int, message_ids: list[int], account_id: int | None = None
    ) -> bool:
        self.deleted_message_ids.extend(message_ids)
        for mid in message_ids:
            self.messages_store.pop(mid, None)
        return True

    async def send_media_album(
        self,
        target_channel_id: int,
        source_channel_id: int,
        message_ids: list[int],
        caption: str,
        account_id: int | None = None,
        schedule_date: Any = None,
    ) -> list[int]:
        self.published_albums.append({
            "target_channel_id": target_channel_id,
            "source_channel_id": source_channel_id,
            "message_ids": message_ids,
            "caption": caption,
        })
        return [9901, 9902]


@pytest.mark.asyncio
async def test_batch_edit_captions_append():
    gateway = DummySelfOrgGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/-100123/messages/batch-edit-caption",
                json={
                    "message_ids": [101, 103],
                    "text": "#ejemplo1",
                    "mode": "append",
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "success"
            assert data["updated_count"] == 2
            assert data["message_ids"] == [101, 103]

            assert gateway.messages_store[101] == "Video tutorial parte 1 #ejemplo1"
            assert gateway.messages_store[103] == "#ejemplo1"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_batch_edit_captions_prepend():
    gateway = DummySelfOrgGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/-100123/messages/batch-edit-caption",
                json={
                    "message_ids": [102],
                    "text": "#destacado",
                    "mode": "prepend",
                },
            )
            assert res.status_code == 200
            assert gateway.messages_store[102] == "#destacado Video tutorial parte 2"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_batch_edit_captions_replace():
    gateway = DummySelfOrgGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/-100123/messages/batch-edit-caption",
                json={
                    "message_ids": [101],
                    "text": "#ejemplo1 Solo nuevo texto",
                    "mode": "replace",
                },
            )
            assert res.status_code == 200
            assert gateway.messages_store[101] == "#ejemplo1 Solo nuevo texto"
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


@pytest.mark.asyncio
async def test_same_channel_album_repack_with_purge():
    gateway = DummySelfOrgGateway()
    app.dependency_overrides[get_telegram_gateway] = lambda: gateway
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/channels/-100555/publish-album",
                json={
                    "target_channel_id": -100555,  # Same channel!
                    "message_ids": [101, 102],
                    "caption": "#ejemplo1 Pack organizado en album",
                    "delete_source_messages": True,
                },
            )
            assert res.status_code == 201
            data = res.json()
            assert data["status"] == "success"
            assert data["source_channel_id"] == -100555
            assert data["target_channel_id"] == -100555
            assert data["deleted_source_count"] == 2

            # Verifies album was sent to the same channel
            assert len(gateway.published_albums) == 1
            assert gateway.published_albums[0]["target_channel_id"] == -100555

            # Verifies loose source messages were deleted
            assert gateway.deleted_message_ids == [101, 102]
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
