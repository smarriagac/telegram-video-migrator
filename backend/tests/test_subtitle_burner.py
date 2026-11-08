from __future__ import annotations

import os
import tempfile
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.testclient import TestClient

from backend.application.services.subtitle_engine import SubtitleCue, SubtitleEngine
from backend.main import app
from backend.presentation.dependencies import get_current_user
from backend.domain.entities.user import User


def test_subtitle_cue_time_formatting():
    assert SubtitleCue.format_srt_time(0.0) == "00:00:00,000"
    assert SubtitleCue.format_srt_time(1.5) == "00:00:01,500"
    assert SubtitleCue.format_srt_time(65.432) == "00:01:05,432"
    assert SubtitleCue.format_srt_time(3661.05) == "01:01:01,050"

    cue = SubtitleCue(index=1, start_s=1.0, end_s=3.5, text="HOLA MUNDO")
    block = cue.to_srt_block()
    assert "1\n" in block
    assert "00:00:01,000 --> 00:00:03,500\n" in block
    assert "HOLA MUNDO\n" in block


def test_chunk_text_into_cues():
    text = "Este es un video excelente para publicar en historias de Telegram hoy mismo"
    cues = SubtitleEngine.chunk_text_into_cues(text, total_duration_s=12.0, words_per_cue=3)

    assert len(cues) >= 3
    assert cues[0].index == 1
    assert cues[0].start_s == 0.3
    assert cues[-1].end_s <= 12.0
    for cue in cues:
        assert cue.text == cue.text.upper()
        assert cue.duration_s > 0


def test_generate_subtitles_file():
    with tempfile.TemporaryDirectory() as tmp_dir:
        srt_path = os.path.join(tmp_dir, "test.srt")
        _, cues = SubtitleEngine.chunk_text_into_cues("Texto de prueba", 5.0), []

        # Synchronous/async subtitle generator
        async def run():
            return await SubtitleEngine.generate_subtitles(
                video_path="/nonexistent.mp4",
                output_srt_path=srt_path,
                caption_hint="Subtítulos automáticos de alta fidelidad",
                duration_s=6.0,
            )

        import asyncio
        path, cues = asyncio.run(run())

        assert os.path.exists(path)
        assert len(cues) > 0
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "-->" in content
        assert "SUBTÍTULOS" in content or "AUTOMÁTICOS" in content


def test_build_subtitles_filter():
    srt_path = "/tmp/dir with space/test:file.srt"
    filt_yellow = SubtitleEngine.build_subtitles_filter(srt_path, style="KINETIC_YELLOW", margin_v=90)
    assert "subtitles=" in filt_yellow
    assert "PrimaryColour=&H0000FFFF" in filt_yellow
    assert "MarginV=90" in filt_yellow
    assert "\\:" in filt_yellow

    filt_white = SubtitleEngine.build_subtitles_filter(srt_path, style="CLASSIC_WHITE", margin_v=60)
    assert "PrimaryColour=&H00FFFFFF" in filt_white
    assert "MarginV=60" in filt_white

    filt_boxed = SubtitleEngine.build_subtitles_filter(srt_path, style="BOXED_BLACK", margin_v=50)
    assert "BorderStyle=3" in filt_boxed
    assert "BackColour=&H80000000" in filt_boxed


def test_escape_ffmpeg_path():
    escaped = SubtitleEngine.escape_ffmpeg_path("C:\\videos\\clip:one's.srt")
    assert "\\:" in escaped
    assert "clip\\:one" in escaped
    assert "videos/clip" in escaped


def test_api_subtitles_preview_endpoint():
    mock_user = User(
        id=1,
        email="test_sub@telegramhub.local",
        password_hash="hash",
        role="admin",
        is_active=True,
        tenant_id="default",
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app)

    try:
        res = client.post(
            "/api/video-processing/subtitles-preview",
            json={
                "sample_text": "Aprende cómo automatizar canales de Telegram con inteligencia artificial",
                "duration_s": 10.0,
                "style": "KINETIC_YELLOW",
                "margin_v": 75,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["style"] == "KINETIC_YELLOW"
        assert data["total_cues"] >= 2
        assert "filter_preview" in data
        assert "PrimaryColour=&H0000FFFF" in data["filter_preview"]
        assert "-->" in data["srt_content"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_media_ingestion_with_subtitles():
    from backend.application.services.media_ingestion_service import MediaIngestionService

    mock_client = MagicMock()
    mock_msg = MagicMock(id=999)
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
         patch.object(SubtitleEngine, "generate_subtitles", new_callable=AsyncMock) as mock_gen_sub, \
         patch.object(SubtitleEngine, "burn_subtitles_to_video", new_callable=AsyncMock) as mock_burn:

        with tempfile.NamedTemporaryFile(suffix=".mp4") as tmp_vid:
            mock_dl.return_value = (tmp_vid.name, {"title": "Viral Reel", "platform": "tiktok"})
            mock_gen_sub.return_value = ("/tmp/subs.srt", [SubtitleCue(1, 0.0, 3.0, "VIRAL REEL")])
            mock_burn.return_value = tmp_vid.name

            res = await service.ingest(
                tenant_id="default",
                url="https://tiktok.com/@creator/video/12345",
                target_channel_id=-100123456789,
                mode="DIRECT",
                burn_subtitles=True,
                subtitle_style="KINETIC_YELLOW",
            )

            assert res["success"] is True
            assert res["burn_subtitles"] is True
            assert res["subtitle_style"] == "KINETIC_YELLOW"
            mock_gen_sub.assert_called_once()
            mock_burn.assert_called_once()
            mock_client.send_file.assert_called_once()
