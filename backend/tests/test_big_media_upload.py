from __future__ import annotations

import os
import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from backend.domain.entities.user import User, Role
from backend.application.services.big_media_upload_service import (
    BigMediaUploadService,
    get_big_media_upload_service,
)
from backend.presentation.dependencies import get_current_user, get_telegram_gateway
from backend.main import app


@pytest.fixture
def admin_user() -> User:
    return User(
        id=1,
        email="admin@test.local",
        password_hash="fakehash",
        role=Role.ADMIN,
        is_active=True,
    )


@pytest.mark.asyncio
async def test_big_media_upload_service_init_and_chunk_saving():
    service = BigMediaUploadService(chunk_size_bytes=1024 * 1024)  # 1MB chunk size for test
    file_size = 2500 * 1024  # 2.5 MB -> 3 chunks (1MB, 1MB, 0.5MB)

    meta = await service.init_session(
        filename="big_video_test.mp4",
        file_size_bytes=file_size,
        mime_type="video/mp4",
        target_channel_id=-100123456789,
        caption="Test big video upload",
    )

    upload_id = meta["upload_id"]
    assert meta["total_chunks"] == 3
    assert meta["chunk_size"] == 1024 * 1024

    # Save chunk 0
    res0 = await service.save_chunk(upload_id=upload_id, chunk_index=0, chunk_bytes=b"A" * (1024 * 1024))
    assert res0["chunk_index"] == 0
    assert 0 in res0["completed_chunks"]

    # Verify status in between
    status = await service.get_session_status(upload_id)
    assert status["completed_chunks"] == [0]
    assert status["missing_chunks"] == [1, 2]
    assert status["progress_percent"] == pytest.approx(33.3, rel=1e-1)

    # Save chunk 2 (out of order)
    res2 = await service.save_chunk(upload_id=upload_id, chunk_index=2, chunk_bytes=b"C" * (500 * 1024))
    assert 2 in res2["completed_chunks"]

    status2 = await service.get_session_status(upload_id)
    assert set(status2["completed_chunks"]) == {0, 2}
    assert status2["missing_chunks"] == [1]

    # Save chunk 1
    res1 = await service.save_chunk(upload_id=upload_id, chunk_index=1, chunk_bytes=b"B" * (1024 * 1024))
    assert set(res1["completed_chunks"]) == {0, 1, 2}

    status3 = await service.get_session_status(upload_id)
    assert len(status3["missing_chunks"]) == 0
    assert status3["progress_percent"] == 100.0

    # Cleanup
    await service.cancel_session(upload_id)


@pytest.mark.asyncio
async def test_big_media_upload_service_premature_complete_raises_error():
    service = BigMediaUploadService(chunk_size_bytes=1024 * 1024)
    meta = await service.init_session(
        filename="premature_test.mp4",
        file_size_bytes=2 * 1024 * 1024,
        mime_type="video/mp4",
        target_channel_id=-100123456789,
    )
    upload_id = meta["upload_id"]

    # Upload only chunk 0 of 2
    await service.save_chunk(upload_id=upload_id, chunk_index=0, chunk_bytes=b"X" * (1024 * 1024))

    # Attempting to complete should fail because chunk 1 is missing
    with pytest.raises(ValueError, match="Cannot complete upload"):
        await service.complete_and_transmit(upload_id)

    await service.cancel_session(upload_id)


@pytest.mark.asyncio
async def test_big_media_upload_service_cancel_cleanup():
    service = BigMediaUploadService(chunk_size_bytes=1024 * 1024)
    meta = await service.init_session(
        filename="to_cancel.mp4",
        file_size_bytes=1024 * 1024,
        mime_type="video/mp4",
        target_channel_id=-100123456789,
    )
    upload_id = meta["upload_id"]
    await service.save_chunk(upload_id=upload_id, chunk_index=0, chunk_bytes=b"Z" * (1024 * 1024))

    upload_dir = service._get_session_dir(upload_id)
    assert os.path.exists(upload_dir)

    cancelled = await service.cancel_session(upload_id)
    assert cancelled is True
    assert not os.path.exists(upload_dir)


@pytest.mark.asyncio
async def test_big_media_upload_api_lifecycle(admin_user: User):
    transport = ASGITransport(app=app)
    app.dependency_overrides[get_current_user] = lambda: admin_user

    mock_gateway = MagicMock()
    mock_msg = MagicMock()
    mock_msg.id = 9999
    mock_msg.channel_id = -100123456789
    mock_msg.file_size = 2048
    mock_msg.text = "Direct Big Media Chunked Test"
    mock_gateway.send_local_media = AsyncMock(return_value=mock_msg)
    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Initialize upload session
            init_res = await client.post(
                "/api/media/upload/init",
                json={
                    "filename": "video_hd_part.mp4",
                    "file_size_bytes": 2048,
                    "mime_type": "video/mp4",
                    "target_channel_id": -100123456789,
                    "caption": "Direct Big Media Chunked Test",
                    "chunk_size": 1024,
                },
            )
            assert init_res.status_code == 200
            data = init_res.json()
            upload_id = data["upload_id"]
            assert data["total_chunks"] == 2

            # 2. Upload chunk 0
            chunk0_res = await client.post(
                f"/api/media/upload/{upload_id}/chunk",
                params={"chunk_index": 0},
                content=b"A" * 1024,
                headers={"Content-Type": "application/octet-stream"},
            )
            assert chunk0_res.status_code == 200
            assert chunk0_res.json()["chunk_index"] == 0

            # 3. Check status
            status_res = await client.get(f"/api/media/upload/{upload_id}/status")
            assert status_res.status_code == 200
            status_data = status_res.json()
            assert status_data["completed_chunks"] == [0]
            assert status_data["missing_chunks"] == [1]

            # 4. Upload chunk 1
            chunk1_res = await client.post(
                f"/api/media/upload/{upload_id}/chunk",
                params={"chunk_index": 1},
                content=b"B" * 1024,
                headers={"Content-Type": "application/octet-stream"},
            )
            assert chunk1_res.status_code == 200

            # 5. Complete upload and trigger transmission
            comp_res = await client.post(f"/api/media/upload/{upload_id}/complete")
            assert comp_res.status_code == 200
            comp_data = comp_res.json()
            assert comp_data["success"] is True
            assert comp_data["message_id"] == 9999

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_telegram_gateway, None)
