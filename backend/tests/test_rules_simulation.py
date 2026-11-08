from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from backend.application.services.rules_simulation_service import RulesSimulationService
from backend.main import app


def test_simulate_caption_transformation_and_metrics():
    service = RulesSimulationService()
    sample = "Nuevo video disponible en https://t.me/spam_link y http://sitio.com. Contactar @old_channel para bono."

    rules = {
        "strip_links": True,
        "replace_mentions": {"@old_channel": "@new_channel"},
        "remove_words": ["bono"],
        "prepend_header": "🎬 ESTRENO EXCLUSIVO",
        "append_signature": "👉 Únete al canal oficial",
    }

    result = service.simulate(
        sample_caption=sample,
        caption_rules=rules,
        video_width=1920,
        video_height=1080,
    )

    caption_info = result["caption"]
    assert "🎬 ESTRENO EXCLUSIVO" in caption_info["transformed_caption"]
    assert "👉 Únete al canal oficial" in caption_info["transformed_caption"]
    assert "@new_channel" in caption_info["transformed_caption"]
    assert "@old_channel" not in caption_info["transformed_caption"]
    assert "https://t.me/spam_link" not in caption_info["transformed_caption"]
    assert "http://sitio.com" not in caption_info["transformed_caption"]
    assert caption_info["urls_detected"] == 2
    assert caption_info["mentions_detected"] == 1
    assert caption_info["words_removed_count"] == 1


def test_simulate_watermark_and_delogo_geometry():
    service = RulesSimulationService()

    # Test 16:9 widescreen
    res_16_9 = service.simulate(
        video_width=1920,
        video_height=1080,
        filter_type="delogo_and_watermark",
        filter_params={
            "preset": "top_right",
            "watermark_text": "@MiMarcaVIP",
            "watermark_position": "bottom_right",
            "with_box": True,
        },
    )

    delogo = res_16_9["delogo"]
    assert delogo["preset"] == "top_right"
    assert delogo["y"] == 15
    assert delogo["w"] > 0
    assert delogo["h"] > 0

    wm = res_16_9["watermark"]
    assert wm["text"] == "@MiMarcaVIP"
    assert wm["position"] == "bottom_right"
    assert wm["with_box"] is True
    assert wm["preview_x_pct"] > 0.5
    assert wm["preview_y_pct"] > 0.5

    # Check FFmpeg filter command includes both delogo and drawtext
    ffmpeg_str = res_16_9["ffmpeg_filter_string"]
    assert "delogo=" in ffmpeg_str
    assert "drawtext=text='@MiMarcaVIP'" in ffmpeg_str


def test_simulate_aspect_ratio_adaptations():
    service = RulesSimulationService()

    # Vertical 9:16 (Shorts/Reels)
    res_vertical = service.simulate(
        video_width=1080,
        video_height=1920,
        filter_type="watermark_text",
        filter_params={
            "watermark_text": "@VerticalVideo",
            "watermark_position": "center",
        },
    )

    wm = res_vertical["watermark"]
    assert wm["text"] == "@VerticalVideo"
    assert wm["position"] == "center"
    assert wm["x_expr"] == "(w-tw)/2"
    assert wm["y_expr"] == "(h-th)/2"


@pytest.mark.asyncio
async def test_simulate_api_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request must return 401
        unauth = await client.post("/api/video-processing/simulate", json={})
        assert unauth.status_code == 401

        # 2. Login as admin
        login_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@telegramhub.local", "password": "admin1234"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Simulate request
        sim_res = await client.post(
            "/api/video-processing/simulate",
            json={
                "sample_caption": "Texto con link https://t.me/test y @canal",
                "caption_rules": {"strip_links": True},
                "video_width": 1280,
                "video_height": 720,
                "filter_type": "watermark_text",
                "filter_params": {"watermark_text": "@TestBrand"},
            },
            headers=headers,
        )
        assert sim_res.status_code == 200
        data = sim_res.json()
        assert data["success"] is True
        assert "caption" in data
        assert "watermark" in data
        assert "ffmpeg_filter_string" in data
        assert "https://t.me/test" not in data["caption"]["transformed_caption"]
