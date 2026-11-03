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
    class DummyGateway:
        async def get_managed_channels(self, limit: int = 100):
            from backend.domain.entities.channel import Channel
            return [
                Channel(id=-1001, title="Test Channel 1", username="test1", can_post=True),
                Channel(id=-1002, title="Test Channel 2", username="test2", can_post=True),
            ]

    from backend.presentation.dependencies import get_telegram_gateway
    app.dependency_overrides[get_telegram_gateway] = lambda: DummyGateway()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/channels")
            assert res.status_code == 200
            channels = res.json()
            assert isinstance(channels, list)
            assert len(channels) == 2
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)


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

        # Check job queue endpoint
        queue_res = await client.get(f"/api/jobs/{job_id}/queue")
        assert queue_res.status_code == 200
        qdata = queue_res.json()
        assert "job_id" in qdata
        assert "stats" in qdata
        assert "items" in qdata


@pytest.mark.asyncio
async def test_auto_sync_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        src = -100555
        tgt = -100666

        # Initially inactive / not found
        status_res = await client.get(f"/api/channels/{src}/auto-sync-status?target_channel_id={tgt}")
        assert status_res.status_code == 200
        assert status_res.json()["is_active"] is False

        # Toggle on
        payload = {
            "source_channel_id": src,
            "target_channel_id": tgt,
            "is_active": True,
            "source_title": "Source Test",
            "target_title": "Target Test",
        }
        toggle_res = await client.post("/api/channels/auto-sync", json=payload)
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_active"] is True
        assert toggle_res.json()["source_channel_title"] == "Source Test"

        # Check status again
        status_res = await client.get(f"/api/channels/{src}/auto-sync-status?target_channel_id={tgt}")
        assert status_res.status_code == 200
        assert status_res.json()["is_active"] is True
        assert status_res.json()["binding"]["source_channel_title"] == "Source Test"

        # List all
        list_res = await client.get("/api/channels/auto-sync")
        assert list_res.status_code == 200
        bindings = list_res.json()
        assert any(b["source_channel_id"] == src for b in bindings)

        # Toggle off
        payload["is_active"] = False
        toggle_off_res = await client.post("/api/channels/auto-sync", json=payload)
        assert toggle_off_res.status_code == 200
        assert toggle_off_res.json()["is_active"] is False


@pytest.mark.asyncio
async def test_kick_batch_channel_members_endpoint():
    from unittest.mock import AsyncMock, MagicMock
    from backend.presentation.dependencies import get_current_user, get_telegram_gateway, get_postgres_repository
    from backend.domain.entities.user import User, Role

    mock_user = User(
        id="u-admin",
        email="admin@test.com",
        password_hash="hash",
        role=Role.ADMIN,
        tenant_id="00000000-0000-0000-0000-000000000001",
    )

    mock_gateway = MagicMock()
    mock_gateway.kick_chat_member = AsyncMock(return_value=True)

    mock_pg = MagicMock()
    mock_pg.connect = AsyncMock()
    mock_pg.pool = None  # No-op DB pool in unit test

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    app.dependency_overrides[get_postgres_repository] = lambda: mock_pg

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "items": [
                    {"channel_id": -100111, "user_id": 501, "membership_id": "00000000-0000-0000-0000-000000000011"},
                    {"channel_id": -100111, "user_id": 502, "membership_id": "00000000-0000-0000-0000-000000000012"},
                ],
                "reason": "Batch expulsion test",
            }
            res = await client.post("/api/channels/gatekeeper/kick-batch", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["total_requested"] == 2
            assert data["kicked_count"] == 2
            assert data["failed_count"] == 0
            assert mock_gateway.kick_chat_member.await_count == 2
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_telegram_gateway, None)
        app.dependency_overrides.pop(get_postgres_repository, None)



@pytest.mark.asyncio
async def test_gatekeeper_payment_webhook_endpoint():
    from unittest.mock import AsyncMock, MagicMock
    from backend.presentation.dependencies import get_telegram_gateway, get_postgres_repository

    mock_gateway = MagicMock()
    mock_gateway.create_channel_invite_link = AsyncMock(return_value="https://t.me/+PayTestPass123")
    mock_gateway.send_direct_message = AsyncMock(return_value=True)

    mock_pg = MagicMock()
    mock_pg.connect = AsyncMock()
    mock_pg.pool = None

    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway
    app.dependency_overrides[get_postgres_repository] = lambda: mock_pg

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "channel_id": -1004337257363,
                "user_id_or_username": "@buyer_vip",
                "duration_days": 30,
                "amount": 19.99,
                "currency": "USD",
                "payment_provider": "STRIPE",
                "payment_id": "pi_test_123456789",
                "auto_send_dm": True,
            }
            res = await client.post("/api/channels/gatekeeper/webhooks/payment", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["invite_link"] == "https://t.me/+PayTestPass123"
            assert data["target"] == "@buyer_vip"
            assert data["duration_days"] == 30
            assert data["dm_sent"] is True
            mock_gateway.create_channel_invite_link.assert_awaited_once()
            mock_gateway.send_direct_message.assert_awaited_once()
    finally:
        app.dependency_overrides.pop(get_telegram_gateway, None)
        app.dependency_overrides.pop(get_postgres_repository, None)


@pytest.mark.asyncio
async def test_scheduled_job_creation_and_run_now():
    from unittest.mock import AsyncMock, MagicMock
    from backend.presentation.dependencies import get_current_user
    from backend.domain.entities.user import User, Role

    admin_user = User(
        id=1,
        email="admin@test.com",
        password_hash="hash",
        role=Role.ADMIN,
    )
    app.dependency_overrides[get_current_user] = lambda: admin_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            sched_time = "2026-12-31T23:59:59Z"
            create_payload = {
                "source_channel_id": -1001111111,
                "target_channel_id": -1002222222,
                "source_channel_title": "Source Sched",
                "target_channel_title": "Target Sched",
                "scheduled_at": sched_time,
            }
            res = await client.post("/api/jobs", json=create_payload)
            assert res.status_code == 201
            job_data = res.json()
            assert job_data["status"] == "SCHEDULED"
            assert job_data["scheduled_at"] == sched_time
            job_id = job_data["job_id"]

            # Trigger immediate execution
            run_res = await client.post(f"/api/jobs/{job_id}/run-now")
            assert run_res.status_code == 200
            run_data = run_res.json()
            assert run_data["status"] == "RUNNING"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_alerts_endpoints_and_delivery():
    from unittest.mock import AsyncMock, MagicMock
    from backend.presentation.dependencies import get_current_user, get_telegram_gateway
    from backend.domain.entities.user import User, Role

    admin_user = User(
        id=1,
        email="admin@test.com",
        password_hash="hash",
        role=Role.ADMIN,
    )
    mock_gateway = MagicMock()
    mock_gateway.send_direct_message = AsyncMock(return_value=True)

    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_telegram_gateway] = lambda: mock_gateway

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # GET alerts config
            cfg_res = await client.get("/api/alerts/config")
            assert cfg_res.status_code == 200
            cfg_data = cfg_res.json()
            assert "config" in cfg_data
            assert cfg_data["config"]["notify_flood_wait"] is True

            # POST alerts test
            test_res = await client.post(
                "/api/alerts/test",
                json={
                    "recipient": "@test_admin",
                    "severity": "WARNING",
                    "custom_message": "Test operational alert message",
                },
            )
            assert test_res.status_code == 200
            test_data = test_res.json()
            assert test_data["success"] is True
            assert test_data["delivered_to"] == "@test_admin"
            mock_gateway.send_direct_message.assert_awaited_once()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_telegram_gateway, None)





