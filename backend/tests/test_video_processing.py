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
