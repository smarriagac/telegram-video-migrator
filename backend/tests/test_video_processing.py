from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.domain.entities.user import User, Role
from backend.presentation.dependencies import get_current_user


@pytest.fixture
def mock_user():
    return User(
        id=1,
        email="test@example.com",
        password_hash="hash",
        role=Role.ADMIN,
        tenant_id="00000000-0000-0000-0000-000000000001",
    )


@pytest.mark.asyncio
async def test_video_processing_api_lifecycle(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Enqueue job
            payload = {
                "source_channel_id": -100123456,
                "source_message_id": 42,
                "target_channel_id": -100987654,
                "filter_type": "delogo",
                "filter_params": {"preset": "center"},
                "source_channel_title": "Origen Test",
                "target_channel_title": "Destino Test",
                "new_caption": "Caption test sanitized",
            }
            res = await client.post("/api/video-processing/enqueue", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            job = data["job"]
            job_id = job["id"]
            assert job["filter_type"] == "delogo"
            assert job["status"] in ("PENDING", "DOWNLOADING", "PROCESSING")

            # 2. List jobs
            list_res = await client.get("/api/video-processing/jobs")
            assert list_res.status_code == 200
            jobs = list_res.json()
            assert any(j["id"] == job_id for j in jobs)

            # 3. Cancel job
            cancel_res = await client.post(f"/api/video-processing/jobs/{job_id}/cancel")
            assert cancel_res.status_code == 200
            assert cancel_res.json()["success"] is True

            # 4. Retry job
            retry_res = await client.post(f"/api/video-processing/jobs/{job_id}/retry")
            assert retry_res.status_code == 200
            assert retry_res.json()["success"] is True

            # 5. Delete job
            del_res = await client.delete(f"/api/video-processing/jobs/{job_id}")
            assert del_res.status_code == 200
            assert del_res.json()["success"] is True

            # 6. Test watermark detect endpoint
            detect_res = await client.post(
                "/api/video-processing/detect",
                json={"source_channel_id": -100123456, "source_message_id": 42},
            )
            assert detect_res.status_code == 200
            det_data = detect_res.json()
            assert det_data["success"] is True
            assert "preset" in det_data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_transcoding_presets_logic():
    from backend.application.services.video_processing_service import VideoProcessingService, TRANSCODING_PRESETS

    presets = VideoProcessingService.get_presets()
    assert len(presets) >= 4
    preset_ids = [p["id"] for p in presets]
    assert "ORIGINAL" in preset_ids
    assert "1080p" in preset_ids
    assert "720p" in preset_ids
    assert "480p" in preset_ids

    svc = VideoProcessingService(pg_repo=None, gateway_provider=None)

    # 1. ORIGINAL preset
    scale, codec_args = svc._build_transcoding_args("ORIGINAL", 3840, 2160)
    assert scale is None
    assert "-crf" in codec_args
    assert codec_args[codec_args.index("-crf") + 1] == "23"
    assert "-c:a" in codec_args and codec_args[codec_args.index("-c:a") + 1] == "copy"

    # 2. 720p downsampling preset
    scale_720, codec_720 = svc._build_transcoding_args("720p", 3840, 2160)
    assert scale_720 == "scale='min(1280,iw)':-2"
    assert "-crf" in codec_720
    assert codec_720[codec_720.index("-crf") + 1] == "24"
    assert "-maxrate" in codec_720 and codec_720[codec_720.index("-maxrate") + 1] == "2500k"
    assert "-c:a" in codec_720 and codec_720[codec_720.index("-c:a") + 1] == "aac"

    # 3. 1080p with custom CRF override
    scale_1080, codec_1080 = svc._build_transcoding_args("1080p", 1920, 1080, crf=18)
    assert scale_1080 == "scale='min(1920,iw)':-2"
    assert codec_1080[codec_1080.index("-crf") + 1] == "18"

    # 4. 480p SD preset
    scale_480, codec_480 = svc._build_transcoding_args("480p", 1280, 720)
    assert scale_480 == "scale='min(854,iw)':-2"
    assert codec_480[codec_480.index("-crf") + 1] == "26"


@pytest.mark.asyncio
async def test_transcoding_presets_api(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Presets catalog endpoint
            res = await client.get("/api/video-processing/presets")
            assert res.status_code == 200
            data = res.json()
            assert "presets" in data
            assert len(data["presets"]) >= 4

            # 2. Enqueue with resolution_preset
            payload = {
                "source_channel_id": -100123456,
                "source_message_id": 99,
                "target_channel_id": -100987654,
                "resolution_preset": "720p",
                "crf": 25,
            }
            enq_res = await client.post("/api/video-processing/enqueue", json=payload)
            assert enq_res.status_code == 200
            enq_data = enq_res.json()
            assert enq_data["success"] is True
            job_params = enq_data["job"]["filter_params"]
            assert job_params["resolution_preset"] == "720p"
            assert job_params["crf"] == 25
    finally:
        app.dependency_overrides.pop(get_current_user, None)

