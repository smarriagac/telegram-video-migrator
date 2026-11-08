from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.application.services.smart_transcoding_engine import SmartTranscodingEngine
from backend.application.services.video_processing_service import VideoProcessingService
from backend.application.services.dynamic_watermark_detector import (
    DynamicWatermarkDetector,
    WatermarkInterval,
    DynamicWatermarkResult,
)
from backend.application.services.media_ingestion_service import MediaIngestionService
from backend.domain.entities.user import User, Role
from backend.main import app
from backend.presentation.dependencies import get_current_user


@pytest.fixture
def test_user() -> User:
    return User(
        id="user_admin",
        email="admin@example.com",
        password_hash="fake_hash",
        role=Role.ADMIN,
        tenant_id="tenant_default",
    )


def test_build_aspect_ratio_filter_modes():
    # 1. ORIGINAL mode
    vf_type, vf_str = SmartTranscodingEngine.build_aspect_ratio_filter("ORIGINAL", 1920, 1080)
    assert vf_type is None
    assert vf_str is None

    # 2. 9:16_CROP mode
    vf_type, vf_str = SmartTranscodingEngine.build_aspect_ratio_filter("9:16_CROP", 1920, 1080, target_height=1920)
    assert vf_type == "-vf"
    assert "crop=w='min(iw,ih*9/16)'" in vf_str
    assert "scale=1080:1920" in vf_str

    # 3. 9:16_BLUR mode
    fc_type, fc_str = SmartTranscodingEngine.build_aspect_ratio_filter("9:16_BLUR", 1920, 1080, target_height=1920)
    assert fc_type == "-filter_complex"
    assert "split=2[bg_in][fg_in]" in fc_str
    assert "boxblur=20:10[bg]" in fc_str
    assert "overlay=(W-w)/2:(H-h)/2" in fc_str
    assert "scale=1080:1920" in fc_str


def test_aspect_ratio_presets_catalog():
    presets = VideoProcessingService.get_aspect_ratio_presets()
    assert len(presets) >= 3
    preset_ids = [p["id"] for p in presets]
    assert "ORIGINAL" in preset_ids
    assert "9:16_BLUR" in preset_ids
    assert "9:16_CROP" in preset_ids


def test_watermark_interval_to_delogo_expr():
    # Static interval
    static_inv = WatermarkInterval(
        start_time_s=0.0,
        end_time_s=0.0,
        x_pct=0.7,
        y_pct=0.05,
        w_pct=0.25,
        h_pct=0.1,
        zone="top_right",
    )
    expr = static_inv.to_delogo_expr(1920, 1080)
    assert "delogo=x=" in expr
    assert "enable=" not in expr

    # Time-bounded dynamic interval
    dyn_inv = WatermarkInterval(
        start_time_s=2.5,
        end_time_s=7.5,
        x_pct=0.05,
        y_pct=0.05,
        w_pct=0.25,
        h_pct=0.1,
        zone="top_left",
    )
    dyn_expr = dyn_inv.to_delogo_expr(1920, 1080)
    assert "delogo=x=" in dyn_expr
    assert ":enable='between(t,2.50,7.50)'" in dyn_expr


def test_media_ingestion_platform_identification():
    assert MediaIngestionService.identify_platform("https://www.tiktok.com/@creator/video/12345") == "tiktok"
    assert MediaIngestionService.identify_platform("https://www.instagram.com/reel/C8xyz123/") == "instagram"
    assert MediaIngestionService.identify_platform("https://youtube.com/shorts/abcde12345") == "youtube"
    assert MediaIngestionService.identify_platform("https://youtu.be/abcde12345") == "youtube"
    assert MediaIngestionService.identify_platform("https://x.com/user/status/987654321") == "twitter"
    assert MediaIngestionService.identify_platform("https://example.com/video.mp4") == "generic"


@patch("yt_dlp.YoutubeDL")
def test_media_ingestion_inspect_url(mock_ydl_class):
    mock_ydl_instance = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl_instance

    mock_ydl_instance.extract_info.return_value = {
        "title": "Amazing Cat Clip",
        "uploader": "@catlover",
        "duration": 24.5,
        "thumbnail": "https://cdn.example.com/thumb.jpg",
        "webpage_url": "https://www.tiktok.com/@catlover/video/123",
        "width": 1080,
        "height": 1920,
    }

    info = MediaIngestionService.inspect_url("https://www.tiktok.com/@catlover/video/123")
    assert info["success"] is True
    assert info["platform"] == "tiktok"
    assert info["title"] == "Amazing Cat Clip"
    assert info["uploader"] == "@catlover"
    assert info["duration"] == 24.5
    assert info["thumbnail"] == "https://cdn.example.com/thumb.jpg"


@pytest.mark.asyncio
async def test_media_ingestion_direct_flow():
    mock_client = AsyncMock()
    mock_gateway = MagicMock()
    mock_gateway._get_client.return_value = mock_client
    mock_gateway._ensure_connected = AsyncMock()

    sent_msg = MagicMock()
    sent_msg.id = 9988
    mock_client.send_file = AsyncMock(return_value=sent_msg)
    mock_client.get_input_entity = AsyncMock(return_value=MagicMock())

    service = MediaIngestionService(
        gateway_provider=lambda tenant_id: mock_gateway,
    )

    with patch.object(
        MediaIngestionService,
        "download_media",
        return_value=("/tmp/fake_video.mp4", {"title": "Viral Reel", "platform": "instagram"}),
    ):
        with patch("os.path.exists", return_value=True):
            res = await service.ingest(
                tenant_id="tenant_1",
                url="https://www.instagram.com/reel/123/",
                target_channel_id=12345678,
                mode="DIRECT",
                caption_override="Watch this! #viral",
            )
            assert res["success"] is True
            assert res["mode"] == "DIRECT"
            assert res["message_id"] == 9988
            mock_client.send_file.assert_called_once()


def test_api_aspect_ratios_endpoint(test_user):
    app.dependency_overrides[get_current_user] = lambda: test_user
    client = TestClient(app)

    try:
        resp = client.get("/api/video-processing/aspect-ratios")
        assert resp.status_code == 200
        data = resp.json()
        assert "aspect_ratios" in data
        ids = [p["id"] for p in data["aspect_ratios"]]
        assert "9:16_BLUR" in ids
        assert "9:16_CROP" in ids
    finally:
        app.dependency_overrides.clear()
