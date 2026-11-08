from __future__ import annotations

import os
import subprocess
import tempfile
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.testclient import TestClient

from backend.application.services.thumbnail_engine import ThumbnailEngine
from backend.main import app
from backend.presentation.dependencies import get_current_user
from backend.domain.entities.user import User


@pytest.fixture
def sample_video(tmp_path):
    """Generates a small 3-second test MP4 video using ffmpeg."""
    video_path = str(tmp_path / "sample_video.mp4")
    cmd = [
        "ffmpeg",
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=3:size=640x360:rate=25",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        video_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return video_path


@pytest.mark.asyncio
async def test_extract_poster_frame(sample_video, tmp_path):
    out_thumb = str(tmp_path / "thumb.jpg")
    result = await ThumbnailEngine.extract_poster_frame(
        video_path=sample_video,
        output_jpg_path=out_thumb,
        percent=0.5,
        max_dim=320,
    )

    assert os.path.exists(result)
    assert os.path.getsize(result) > 100
    assert result == out_thumb


@pytest.mark.asyncio
async def test_extract_frame_candidates(sample_video, tmp_path):
    cands_dir = str(tmp_path / "candidates")
    candidates = await ThumbnailEngine.extract_frame_candidates(
        video_path=sample_video,
        output_dir=cands_dir,
        count=3,
        max_dim=240,
    )

    assert len(candidates) == 3
    for cand in candidates:
        assert cand["index"] in (1, 2, 3)
        assert os.path.exists(cand["file_path"])
        assert cand["size_bytes"] > 0
        assert 0.0 <= cand["timestamp_s"] <= 3.0


@pytest.mark.asyncio
async def test_generate_segment_thumbnails(sample_video, tmp_path):
    out_dir = str(tmp_path / "seg_thumbs")
    thumbs = await ThumbnailEngine.generate_segment_thumbnails(
        segment_paths=[sample_video, sample_video],
        output_dir=out_dir,
    )

    assert len(thumbs) == 2
    for t in thumbs:
        assert os.path.exists(t)
        assert os.path.getsize(t) > 0


def test_api_thumbnail_preview_endpoint():
    mock_user = User(
        id=1,
        email="thumb_test@telegramhub.local",
        password_hash="hash",
        role="admin",
        is_active=True,
        tenant_id="default",
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app)

    try:
        res = client.post(
            "/api/video-processing/thumbnail-preview",
            json={
                "duration_s": 90.0,
                "candidate_count": 4,
                "max_dim": 320,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["duration_s"] == 90.0
        assert len(data["candidates"]) == 4
        assert data["recommended_timestamp_s"] > 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_media_ingestion_with_thumbnail():
    from backend.application.services.media_ingestion_service import MediaIngestionService

    mock_client = MagicMock()
    mock_msg = MagicMock(id=888)
    mock_client.send_file = AsyncMock(return_value=mock_msg)
    mock_client.get_entity = AsyncMock(return_value=MagicMock())
    mock_client.get_input_entity = AsyncMock(return_value=MagicMock())

    mock_gateway = MagicMock()
    mock_gateway._get_client = MagicMock(return_value=mock_client)
    mock_gateway._ensure_connected = AsyncMock(return_value=None)

    service = MediaIngestionService(
        gateway_provider=lambda tenant_id: mock_gateway,
    )

    with patch.object(service, "download_media") as mock_dl, \
         patch.object(ThumbnailEngine, "extract_poster_frame", new_callable=AsyncMock) as mock_thumb:

        with tempfile.NamedTemporaryFile(suffix=".mp4") as tmp_vid:
            mock_dl.return_value = (tmp_vid.name, {"title": "Cool Video", "platform": "instagram"})
            mock_thumb.return_value = "/tmp/fake_thumb.jpg"

            # Create the fake thumb file so os.path.exists succeeds
            with open("/tmp/fake_thumb.jpg", "w") as f:
                f.write("fake_jpeg_data")

            res = await service.ingest(
                tenant_id="default",
                url="https://instagram.com/reel/abcde123",
                target_channel_id=-100987654321,
                mode="DIRECT",
                generate_thumbnail=True,
            )

            assert res["success"] is True
            assert res["thumbnail_generated"] is True
            mock_thumb.assert_called_once()
            # Verify thumb parameter was passed to client.send_file
            send_call = mock_client.send_file.call_args
            assert send_call is not None
            assert send_call.kwargs.get("thumb") == "/tmp/fake_thumb.jpg"
