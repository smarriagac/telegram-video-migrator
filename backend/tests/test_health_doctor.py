from __future__ import annotations

import os
import tempfile
import pytest
from httpx import AsyncClient, ASGITransport

from backend.domain.entities.user import User, Role
from backend.application.services.health_doctor_service import (
    HealthDoctorService,
    get_health_doctor_service,
)
from backend.presentation.dependencies import get_current_user
from backend.main import app


@pytest.fixture
def admin_user() -> User:
    return User(
        id=1,
        email="admin@test.local",
        password_hash="fakehash",
        role=Role.ADMIN,
        is_active=True,
    )


@pytest.fixture
def operator_user() -> User:
    return User(
        id=2,
        email="operator@test.local",
        password_hash="fakehash",
        role=Role.OPERATOR,
        is_active=True,
    )


@pytest.mark.asyncio
async def test_health_doctor_service_diagnose_all():
    service = HealthDoctorService()
    report = await service.diagnose_all()

    assert "overall_status" in report
    assert report["overall_status"] in ["HEALTHY", "DEGRADED", "CRITICAL"]
    assert "timestamp" in report
    assert "checks" in report

    checks = report["checks"]
    assert "database" in checks
    assert "telegram_mtproto" in checks
    assert "media_engine" in checks
    assert "storage" in checks
    assert "background_services" in checks

    # Storage check structure
    assert checks["storage"]["status"] in ["HEALTHY", "DEGRADED", "CRITICAL"]
    assert checks["storage"]["free_gb"] >= 0
    assert checks["storage"]["total_gb"] > 0

    # Media engine structure
    assert "ffmpeg_available" in checks["media_engine"]
    assert "ffprobe_available" in checks["media_engine"]


@pytest.mark.asyncio
async def test_health_doctor_service_remediation_temp_storage():
    service = HealthDoctorService()

    # Create dummy temp file
    temp_dir = tempfile.gettempdir()
    test_file = os.path.join(temp_dir, "migrator_test_doctor_clean.tmp")
    with open(test_file, "w") as f:
        f.write("test scratchpad cleanup")

    assert os.path.exists(test_file)

    result = await service.remediate(action="clean_temp_storage")
    assert result["remediated"] is True
    assert "files_deleted" in result
    assert "bytes_freed" in result
    assert not os.path.exists(test_file)


@pytest.mark.asyncio
async def test_health_doctor_service_remediation_invalid_action():
    service = HealthDoctorService()
    with pytest.raises(ValueError, match="Unknown remediation action"):
        await service.remediate(action="non_existent_action")


@pytest.mark.asyncio
async def test_health_doctor_service_remediation_governor_and_db():
    service = HealthDoctorService()

    # Reset governor
    res_gov = await service.remediate(action="reset_rate_governor")
    assert res_gov["remediated"] is True
    assert "channels_reset" in res_gov

    # Test DB latency probe
    res_lat = await service.remediate(action="test_db_latency")
    assert res_lat["remediated"] is True
    assert "avg_latency_ms" in res_lat
    assert "samples_ms" in res_lat
    assert len(res_lat["samples_ms"]) == 3


@pytest.mark.asyncio
async def test_doctor_api_endpoints_rbac(admin_user: User, operator_user: User):
    transport = ASGITransport(app=app)

    # 1. Anonymous access should be rejected (401 or 403)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health/doctor")
        assert res.status_code in [401, 403]

    # 2. Operator access should be rejected (403 forbidden - requires ADMIN)
    app.dependency_overrides[get_current_user] = lambda: operator_user
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/health/doctor")
            assert res.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # 3. Admin access should succeed with 200 OK
    app.dependency_overrides[get_current_user] = lambda: admin_user
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/health/doctor")
            assert res.status_code == 200
            data = res.json()
            assert "overall_status" in data
            assert "checks" in data
            assert "database" in data["checks"]
            assert "media_engine" in data["checks"]

            # Test remediation endpoint as Admin
            rem_res = await client.post(
                "/api/health/doctor/remediate",
                json={"action": "clean_temp_storage"},
            )
            assert rem_res.status_code == 200
            rem_data = rem_res.json()
            assert rem_data["remediated"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)
