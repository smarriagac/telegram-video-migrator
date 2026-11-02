from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.domain.entities.user import User, Role
from backend.domain.entities.tenant import PlanTier
from backend.presentation.dependencies import get_current_user


@pytest.fixture
def mock_billing_user():
    return User(
        id=1,
        email="billing_admin@telegramhub.local",
        password_hash="hashed",
        role=Role.ADMIN,
        tenant_id="00000000-0000-0000-0000-000000000001",
    )


@pytest.mark.asyncio
async def test_billing_checkout_endpoint(mock_billing_user):
    app.dependency_overrides[get_current_user] = lambda: mock_billing_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/billing/checkout",
                json={"tier": PlanTier.CREATOR.value, "annual": False},
            )
            assert res.status_code == 200
            data = res.json()
            assert "checkout_url" in data
            assert "session_id" in data
            assert data["session_id"].startswith("cs_")
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_billing_subscription_endpoint(mock_billing_user):
    app.dependency_overrides[get_current_user] = lambda: mock_billing_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/billing/subscription")
            assert res.status_code == 200
            data = res.json()
            assert "tenant_id" in data
            assert "plan_tier" in data
            assert "quotas" in data
            assert "max_telegram_accounts" in data["quotas"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_stripe_webhook_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_mock_123",
                    "customer": "cus_test_123",
                    "subscription": "sub_test_123",
                    "metadata": {
                        "tenant_id": "00000000-0000-0000-0000-000000000001",
                        "plan_tier": "PRO_AGENCY",
                    },
                }
            },
        }
        res = await client.post("/api/billing/webhook", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["received"] is True
        assert data["event_type"] == "checkout.session.completed"
