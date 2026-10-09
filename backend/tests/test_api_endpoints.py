from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app


@pytest.mark.asyncio
async def test_health_check_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok", "service": "telegram-video-migrator"}


@pytest.mark.asyncio
async def test_channels_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/channels")
        assert res.status_code == 200
        channels = res.json()
        assert isinstance(channels, list)
        assert len(channels) >= 2


@pytest.mark.asyncio
async def test_create_and_get_job_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Start job
        payload = {"source_channel_id": -1001, "target_channel_id": -1002}
        create_res = await client.post("/api/jobs", json=payload)
        assert create_res.status_code == 201
        data = create_res.json()
        assert "job_id" in data
        job_id = data["job_id"]

        # Fetch job details
        get_res = await client.get(f"/api/jobs/{job_id}")
        assert get_res.status_code == 200
        assert get_res.json()["job_id"] == job_id

        # Cancel job
        cancel_res = await client.post(f"/api/jobs/{job_id}/cancel")
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "CANCELLED"
