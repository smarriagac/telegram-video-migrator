from __future__ import annotations

import pytest
import uuid
from httpx import AsyncClient, ASGITransport, Response
from unittest.mock import AsyncMock, patch

from backend.domain.entities.user import User, Role
from backend.domain.entities.webhook_endpoint import WebhookEndpoint
from backend.application.services.webhook_dispatcher_service import WebhookDispatcherService
from backend.infrastructure.persistence.postgres_webhook_repository import PostgresWebhookRepository
from backend.main import app


def test_webhook_endpoint_filtering():
    ep = WebhookEndpoint(
        name="Discord Ops",
        target_type="DISCORD",
        url="https://discord.com/api/webhooks/test",
        events=["flood_wait", "job.failed"],
        is_enabled=True,
    )
    assert ep.subscribes_to("flood_wait") is True
    assert ep.subscribes_to("job.failed") is True
    assert ep.subscribes_to("backup.created") is False

    ep.is_enabled = False
    assert ep.subscribes_to("flood_wait") is False


def test_webhook_dispatcher_payload_formatting():
    repo = PostgresWebhookRepository()
    dispatcher = WebhookDispatcherService(repository=repo)

    # Discord format
    discord_ep = WebhookEndpoint(name="Discord", target_type="DISCORD", url="https://discord.com")
    discord_payload = dispatcher.format_payload(
        endpoint=discord_ep,
        event_type="flood_wait",
        title="FloodWait Límite",
        message="Espera 120 segundos",
        severity="WARNING",
        metadata={"seconds": 120, "cuenta": 1},
    )
    assert "embeds" in discord_payload
    assert discord_payload["embeds"][0]["title"] == "FloodWait Límite"
    assert discord_payload["embeds"][0]["color"] == 0xF59E0B  # Warning Amber

    # Slack format
    slack_ep = WebhookEndpoint(name="Slack", target_type="SLACK", url="https://slack.com")
    slack_payload = dispatcher.format_payload(
        endpoint=slack_ep,
        event_type="job.failed",
        title="Job Error",
        message="Fallo crítico",
        severity="ERROR",
    )
    assert "attachments" in slack_payload
    assert slack_payload["attachments"][0]["color"] == "#EF4444"

    # Generic format
    gen_ep = WebhookEndpoint(
        name="Custom Webhook",
        target_type="GENERIC",
        url="https://api.mycompany.com/webhook",
        secret_token="my_secret_key_123",
    )
    gen_payload = dispatcher.format_payload(
        endpoint=gen_ep,
        event_type="backup.created",
        title="Backup Listo",
        message="Snapshot generado",
        severity="INFO",
    )
    assert gen_payload["event"] == "backup.created"
    assert gen_payload["severity"] == "INFO"

    # Signature
    sig = dispatcher.generate_signature(b'{"test":1}', "my_secret_key_123")
    assert len(sig) == 64  # SHA256 hex length


@pytest.mark.asyncio
async def test_webhook_dispatch_success_and_retry():
    repo = PostgresWebhookRepository()
    dispatcher = WebhookDispatcherService(repository=repo)

    ep = WebhookEndpoint(
        id="whk_test_retry",
        name="Test Retry Webhook",
        target_type="GENERIC",
        url="https://mock.webhook.test/endpoint",
        secret_token="secret",
    )

    # Mock httpx client response
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        # First call fails with 500, second succeeds with 200
        mock_post.side_effect = [
            Response(status_code=500, text="Internal Server Error"),
            Response(status_code=200, text='{"status":"ok"}'),
        ]

        success, status_code, err = await dispatcher.dispatch_to_endpoint(
            endpoint=ep,
            event_type="test.ping",
            title="Ping",
            message="Test",
            max_retries=2,
        )

        assert success is True
        assert status_code == 200
        assert err is None
        assert mock_post.call_count == 2


@pytest.mark.asyncio
async def test_postgres_webhook_repository_crud():
    repo = PostgresWebhookRepository()
    await repo.initialize_schema()
    tenant_id = "00000000-0000-0000-0000-000000000001"

    # 1. Create Webhook
    ep = WebhookEndpoint(
        id="whk_crud_test",
        tenant_id=tenant_id,
        name="Discord Incidents",
        target_type="DISCORD",
        url="https://discord.com/api/webhooks/123/abc",
        events=["job.failed", "flood_wait"],
    )
    created = await repo.create_webhook(ep)
    assert created.id == "whk_crud_test"

    # 2. Get Webhook
    fetched = await repo.get_webhook(webhook_id="whk_crud_test", tenant_id=tenant_id)
    assert fetched is not None
    assert fetched.name == "Discord Incidents"
    assert fetched.target_type == "DISCORD"

    # 3. Update Webhook
    fetched.name = "Discord Critical Alerts"
    fetched.is_enabled = False
    updated = await repo.update_webhook(fetched)
    assert updated is not None
    assert updated.name == "Discord Critical Alerts"
    assert updated.is_enabled is False

    # 4. List Webhooks
    all_webhooks = await repo.list_webhooks(tenant_id=tenant_id)
    assert any(w.id == "whk_crud_test" for w in all_webhooks)

    # 5. Record dispatch outcome
    await repo.record_dispatch_result(
        webhook_id="whk_crud_test",
        tenant_id=tenant_id,
        status_code=204,
        error=None,
    )
    refetched = await repo.get_webhook(webhook_id="whk_crud_test", tenant_id=tenant_id)
    assert refetched.last_status_code == 204
    assert refetched.last_dispatched_at is not None

    # 6. Delete Webhook
    deleted = await repo.delete_webhook(webhook_id="whk_crud_test", tenant_id=tenant_id)
    assert deleted is True
    assert await repo.get_webhook(webhook_id="whk_crud_test", tenant_id=tenant_id) is None


@pytest.mark.asyncio
async def test_webhooks_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request rejected
        unauth = await client.get("/api/webhooks")
        assert unauth.status_code == 401

        # 2. Login as admin
        login_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@telegramhub.local", "password": "admin1234"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create webhook via API
        create_res = await client.post(
            "/api/webhooks",
            headers=headers,
            json={
                "name": "Slack Operations Channel",
                "target_type": "SLACK",
                "url": "https://hooks.slack.com/services/T00/B00/XXXX",
                "events": ["flood_wait", "backup.created"],
                "is_enabled": True,
            },
        )
        assert create_res.status_code == 201
        created_data = create_res.json()
        webhook_id = created_data["id"]
        assert created_data["name"] == "Slack Operations Channel"
        assert created_data["target_type"] == "SLACK"

        # 4. List webhooks
        list_res = await client.get("/api/webhooks", headers=headers)
        assert list_res.status_code == 200
        assert any(w["id"] == webhook_id for w in list_res.json())

        # 5. Dry-run test endpoint
        with patch(
            "backend.application.services.webhook_dispatcher_service.WebhookDispatcherService.dispatch_to_endpoint",
            new_callable=AsyncMock,
        ) as mock_disp:
            mock_disp.return_value = (True, 200, None)
            test_res = await client.post(
                f"/api/webhooks/{webhook_id}/test",
                headers=headers,
            )
            assert test_res.status_code == 200
            assert test_res.json()["success"] is True
            assert test_res.json()["status_code"] == 200

        # 6. Delete webhook
        del_res = await client.delete(f"/api/webhooks/{webhook_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True


@pytest.mark.asyncio
async def test_webhook_delivery_entity_and_backoff():
    from backend.domain.entities.webhook_delivery import WebhookDelivery, WebhookDeliveryStatus

    deliv = WebhookDelivery(
        webhook_id="whk_unit_1",
        event_type="job.failed",
        url="https://example.com/webhook",
        payload={"job_id": "test-123", "error": "rate limited"},
        max_attempts=3,
    )
    assert deliv.status == WebhookDeliveryStatus.PENDING.value
    assert deliv.attempts == 0

    # 1. Mark first failure -> increments attempt and sets next_retry_at
    deliv.mark_failure(status_code=500, error="Internal error")
    assert deliv.attempts == 1
    assert deliv.status == WebhookDeliveryStatus.PENDING.value
    assert deliv.next_retry_at is not None
    assert deliv.last_status_code == 500

    # 2. Mark second failure
    deliv.mark_failure(status_code=502, error="Bad gateway")
    assert deliv.attempts == 2
    assert deliv.status == WebhookDeliveryStatus.PENDING.value

    # 3. Mark third failure -> exhausts max_attempts (3) -> transitions to DLQ
    deliv.mark_failure(status_code=503, error="Service unavailable")
    assert deliv.attempts == 3
    assert deliv.status == WebhookDeliveryStatus.DLQ.value
    assert deliv.next_retry_at is None

    # 4. Success resets error and transitions to DELIVERED
    deliv.mark_success(status_code=200)
    assert deliv.status == WebhookDeliveryStatus.DELIVERED.value
    assert deliv.last_status_code == 200
    assert deliv.last_error is None


@pytest.mark.asyncio
async def test_webhook_repository_delivery_crud_and_dlq():
    from backend.domain.entities.webhook_delivery import WebhookDelivery, WebhookDeliveryStatus

    repo = PostgresWebhookRepository()
    await repo.initialize_schema()
    tenant_id = f"tenant_{uuid.uuid4().hex[:8]}"
    whk_id = f"whk_{uuid.uuid4().hex[:8]}"

    # 1. Create delivery
    deliv1 = WebhookDelivery(
        webhook_id=whk_id,
        tenant_id=tenant_id,
        event_type="flood_wait",
        url="https://test.local/hook1",
        payload={"seconds": 60},
        status=WebhookDeliveryStatus.PENDING.value,
        attempts=1,
    )
    saved1 = await repo.create_delivery(deliv1)
    assert saved1.id == deliv1.id

    # 2. Create DLQ delivery
    deliv2 = WebhookDelivery(
        webhook_id=whk_id,
        tenant_id=tenant_id,
        event_type="job.failed",
        url="https://test.local/hook2",
        payload={"job_id": "job-dlq-1"},
        status=WebhookDeliveryStatus.DLQ.value,
        attempts=5,
        last_error="HTTP 500: Server Error",
    )
    await repo.create_delivery(deliv2)

    # 3. Get delivery
    fetched = await repo.get_delivery(deliv1.id, tenant_id=tenant_id)
    assert fetched is not None
    assert fetched.event_type == "flood_wait"

    # 4. List deliveries
    all_delivs, count = await repo.list_deliveries(tenant_id=tenant_id)
    assert count == 2
    assert len(all_delivs) == 2

    # 5. List DLQ only
    dlq_items, dlq_count = await repo.get_dead_letter_deliveries(tenant_id=tenant_id)
    assert dlq_count == 1
    assert dlq_items[0].id == deliv2.id

    # 6. Summary metrics
    summary = await repo.get_dlq_summary(tenant_id=tenant_id)
    assert summary["total"] == 2
    assert summary["dlq"] == 1
    assert summary["pending"] == 1

    # 7. Delete delivery
    deleted = await repo.delete_delivery(deliv1.id, tenant_id=tenant_id)
    assert deleted is True
    assert await repo.get_delivery(deliv1.id, tenant_id=tenant_id) is None


@pytest.mark.asyncio
async def test_webhook_retry_engine_and_api():
    from backend.domain.entities.webhook_delivery import WebhookDelivery, WebhookDeliveryStatus
    from backend.application.services.webhook_retry_engine import WebhookRetryEngine
    from backend.main import app
    from backend.presentation.dependencies import get_current_user

    repo = PostgresWebhookRepository()
    await repo.initialize_schema()
    tenant_id = f"tenant_{uuid.uuid4().hex[:8]}"
    whk_id = f"whk_{uuid.uuid4().hex[:8]}"

    # Setup endpoint and failed delivery
    ep = WebhookEndpoint(
        id=whk_id,
        name="Engine Hook",
        target_type="GENERIC",
        url="https://retry.mock.test/hook",
        tenant_id=tenant_id,
    )
    await repo.create_webhook(ep)

    deliv = WebhookDelivery(
        webhook_id=ep.id,
        tenant_id=tenant_id,
        event_type="channel.eviction",
        url=ep.url,
        payload={"channel_id": 999},
        status=WebhookDeliveryStatus.DLQ.value,
        attempts=5,
        last_error="Network timeout",
    )
    await repo.create_delivery(deliv)

    retry_engine = WebhookRetryEngine(repository=repo)

    # Mock post to simulate successful retry
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = Response(status_code=200, text='{"success":true}')

        ok, status_code, err = await retry_engine.retry_single_delivery(
            delivery_id=deliv.id,
            tenant_id=tenant_id,
        )
        assert ok is True
        assert status_code == 200

        # Delivery should now be DELIVERED
        refetched = await repo.get_delivery(deliv.id, tenant_id=tenant_id)
        assert refetched.status == WebhookDeliveryStatus.DELIVERED.value

    # Test API endpoints
    mock_admin = User(
        id=str(uuid.uuid4()),
        email="admin_dlq@example.com",
        password_hash="hashed_pw_test",
        role=Role.ADMIN,
        tenant_id=tenant_id,
    )
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    headers = {"Authorization": "Bearer fake_token"}

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Deliveries summary
            sum_res = await client.get("/api/webhooks/deliveries/summary", headers=headers)
            assert sum_res.status_code == 200
            assert "dlq" in sum_res.json()
            assert "delivered" in sum_res.json()

            # Deliveries list
            list_res = await client.get("/api/webhooks/deliveries", headers=headers)
            assert list_res.status_code == 200
            assert "items" in list_res.json()

            # Retry all DLQ
            batch_res = await client.post("/api/webhooks/deliveries/dlq/retry-all", headers=headers)
            assert batch_res.status_code == 200
            assert "total_retried" in batch_res.json()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        await repo.delete_webhook(whk_id, tenant_id=tenant_id)
        await repo.delete_delivery(deliv.id, tenant_id=tenant_id)

