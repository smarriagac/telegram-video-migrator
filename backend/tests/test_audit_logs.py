from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from backend.domain.entities.audit_log import AuditLog
from backend.domain.entities.user import Role
from backend.infrastructure.persistence.postgres_repository import PostgresRepository
from backend.main import app


@pytest.mark.asyncio
async def test_audit_repository_lifecycle():
    repo = PostgresRepository()
    await repo.initialize_schema()

    log_entry = AuditLog(
        id=None,
        user_id=1,
        user_email="admin@telegramhub.local",
        action="TEST_ACTION",
        resource="test:resource",
        details={"info": "Testing audit log"},
        ip_address="127.0.0.1",
    )
    saved = await repo.record_audit_log(log_entry)
    assert saved.id is not None
    assert saved.action == "TEST_ACTION"
    assert saved.created_at is not None

    logs = await repo.list_audit_logs(limit=10, action="TEST_ACTION")
    assert len(logs) >= 1
    assert logs[0].action == "TEST_ACTION"
    assert logs[0].user_email == "admin@telegramhub.local"


@pytest.mark.asyncio
async def test_audit_api_endpoint_rbac_and_logging():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request must fail
        unauth_res = await client.get("/api/audit")
        assert unauth_res.status_code == 401

        # 2. Login as admin
        login_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@telegramhub.local", "password": "admin1234"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Request audit logs as admin
        audit_res = await client.get("/api/audit", headers=headers)
        assert audit_res.status_code == 200
        data = audit_res.json()
        assert "items" in data
        assert "total" in data
        logs = data["items"]

        # 4. Verify login was audited
        actions = [l["action"] for l in logs]
        assert "LOGIN" in actions

        # 5. Filter by action
        filtered_res = await client.get("/api/audit?action=LOGIN", headers=headers)
        assert filtered_res.status_code == 200
        filtered_data = filtered_res.json()
        assert all(l["action"] == "LOGIN" for l in filtered_data["items"])
