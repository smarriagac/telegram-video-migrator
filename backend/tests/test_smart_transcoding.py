import pytest
from httpx import AsyncClient, ASGITransport

from backend.application.services.smart_transcoding_engine import (
    SmartTranscodingEngine,
    VideoProbeResult,
)
from backend.main import app
from backend.domain.entities.user import User, Role
from backend.presentation.dependencies import get_current_user


@pytest.fixture
def mock_user():
    return User(
        id=1,
        email="admin@test.com",
        password_hash="fakehash",
        role=Role.ADMIN,
        tenant_id="00000000-0000-0000-0000-000000000001",
    )


def test_smart_transcode_auto_mobile_4k():
    probe = VideoProbeResult(
        width=3840,
        height=2160,
        video_codec="h264",
        bitrate_kbps=15000,
    )
    strategy = SmartTranscodingEngine.decide_strategy(probe, preset="AUTO_MOBILE")

    assert strategy.action == "DOWN_SCALE_H265"
    assert strategy.target_codec == "libx265"
    assert strategy.target_width == 1920
    assert strategy.scale_filter == "scale='min(1920,iw)':-2"
    assert strategy.crf == 26
    assert "-tag:v" in strategy.codec_args
    assert strategy.codec_args[strategy.codec_args.index("-tag:v") + 1] == "hvc1"
    assert "-movflags" in strategy.codec_args
    assert "+faststart" in strategy.codec_args


def test_smart_transcode_auto_mobile_1080p():
    probe = VideoProbeResult(
        width=1920,
        height=1080,
        video_codec="h264",
        bitrate_kbps=6000,
    )
    strategy = SmartTranscodingEngine.decide_strategy(probe, preset="AUTO_MOBILE")

    assert strategy.action == "DOWN_SCALE_H265"
    assert strategy.target_codec == "libx265"
    assert strategy.target_width == 1280
    assert strategy.scale_filter == "scale='min(1280,iw)':-2"
    assert strategy.crf == 27
    assert strategy.bitrate_cap_k == 2200


def test_smart_transcode_auto_mobile_pass_through():
    # Already 720p, already HEVC with lean bitrate (1200 kbps)
    probe = VideoProbeResult(
        width=1280,
        height=720,
        video_codec="hevc",
        bitrate_kbps=1200,
    )
    strategy = SmartTranscodingEngine.decide_strategy(probe, preset="AUTO_MOBILE")

    assert strategy.action == "PASS_THROUGH"
    assert strategy.target_codec == "copy"
    assert "-c:v" in strategy.codec_args
    assert strategy.codec_args[strategy.codec_args.index("-c:v") + 1] == "copy"


def test_smart_transcode_explicit_h265_presets():
    probe = VideoProbeResult(width=2560, height=1440, video_codec="h264")

    # 1. H265_720P
    strategy_720 = SmartTranscodingEngine.decide_strategy(probe, preset="H265_720P")
    assert strategy_720.target_width == 1280
    assert strategy_720.target_codec == "libx265"
    assert strategy_720.crf == 27
    assert strategy_720.bitrate_cap_k == 2200

    # 2. H265_480P
    strategy_480 = SmartTranscodingEngine.decide_strategy(probe, preset="H265_480P")
    assert strategy_480.target_width == 854
    assert strategy_480.target_codec == "libx265"
    assert strategy_480.crf == 29
    assert strategy_480.bitrate_cap_k == 1000


@pytest.mark.asyncio
async def test_evaluate_strategy_api_endpoint(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "width": 3840,
                "height": 2160,
                "video_codec": "h264",
                "bitrate_kbps": 12000,
                "preset": "AUTO_MOBILE",
            }
            res = await client.post("/api/video-processing/strategy", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            strat = data["strategy"]
            assert strat["action"] == "DOWN_SCALE_H265"
            assert strat["target_codec"] == "libx265"
            assert strat["target_width"] == 1920
            assert "hvc1" in strat["codec_args"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
