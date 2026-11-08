from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport, Response
from unittest.mock import AsyncMock, patch

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
