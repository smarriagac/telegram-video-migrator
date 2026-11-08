from __future__ import annotations

import csv
import io
import json
import pytest
from httpx import AsyncClient, ASGITransport

from backend.application.services.report_exporter_service import ReportExporterService
from backend.domain.entities.audit_log import AuditLog
from backend.domain.entities.user import Role
from backend.infrastructure.persistence.postgres_repository import PostgresRepository
from backend.main import app


@pytest.fixture
def sample_audit_logs() -> list[AuditLog]:
    return [
        AuditLog(
            id=1,
            user_id=1,
            user_email="admin@telegramhub.local",
            action="LOGIN",
            resource="auth:session",
            details={"ip": "127.0.0.1", "device": "Chrome"},
            ip_address="127.0.0.1",
            created_at="2026-11-07 12:00:00",
        ),
        AuditLog(
            id=2,
            user_id=1,
            user_email="admin@telegramhub.local",
            action="MIGRATION_START",
            resource="job:job_abc123",
            details={"source": "Canal 1", "target": "Canal 2", "items": 50},
            ip_address="127.0.0.1",
            created_at="2026-11-07 12:05:00",
        ),
        AuditLog(
            id=3,
            user_id=None,
            user_email=None,
            action="AUTO_SYNC_TOGGLE",
            resource="sync:channel_999",
            details={"active": True},
            ip_address=None,
            created_at="2026-11-07 12:10:00",
        ),
    ]


@pytest.fixture
def sample_analytics() -> dict:
    return {
        "total_items_migrated": 1250,
        "total_bandwidth_saved_bytes": 10737418240,
        "total_bandwidth_saved_gb": 10.0,
        "duplicates_prevented": 340,
        "total_jobs": 25,
        "active_sync_bindings": 4,
        "efficiency_percent": 99.8,
        "daily_volume": [
            {"date": "2026-11-06", "count": 500, "estimated_mb": 4200.0},
            {"date": "2026-11-07", "count": 750, "estimated_mb": 6500.0},
        ],
        "top_channels": [
            {"channel_id": 1001, "title": "Alpha Channel", "total_items": 800, "volume_gb": 6.8},
        ],
        "recent_transfers": [
            {
                "job_id": "job_1",
                "source_title": "Src Channel",
                "target_title": "Dst Channel",
                "status": "COMPLETED",
                "total_videos": 10,
                "processed_videos": 10,
                "created_at": "2026-11-07 10:00:00",
            }
        ],
    }


def test_generate_audit_csv(sample_audit_logs):
    csv_str = ReportExporterService.generate_audit_csv(sample_audit_logs)
    reader = csv.reader(io.StringIO(csv_str))
    rows = list(reader)

    assert len(rows) == 4  # 1 header + 3 rows
    assert rows[0] == ["id", "timestamp", "user_email", "action", "resource", "ip_address", "details"]
    assert rows[1][0] == "1"
    assert rows[1][2] == "admin@telegramhub.local"
    assert rows[1][3] == "LOGIN"
    assert "Chrome" in rows[1][6]


def test_generate_audit_json(sample_audit_logs):
    json_str = ReportExporterService.generate_audit_json(sample_audit_logs)
    data = json.loads(json_str)

    assert len(data) == 3
    assert data[0]["id"] == 1
    assert data[0]["action"] == "LOGIN"
    assert data[0]["details"]["device"] == "Chrome"


def test_generate_audit_html(sample_audit_logs):
    html = ReportExporterService.generate_audit_html(sample_audit_logs, title="Test Audit Report")

    assert "<!DOCTYPE html>" in html
    assert "Test Audit Report" in html
    assert "@media print" in html
    assert "LOGIN" in html
    assert "admin@telegramhub.local" in html
    assert "window.print()" in html


def test_generate_analytics_csv(sample_analytics):
    csv_str = ReportExporterService.generate_analytics_csv(sample_analytics)

    assert "RESUMEN EJECUTIVO" in csv_str
    assert "Total Videos/Items Migrados,1250" in csv_str
    assert "VOLUMEN DIARIO" in csv_str
    assert "2026-11-06,500,4200.0" in csv_str
    assert "Alpha Channel" in csv_str


def test_generate_analytics_json(sample_analytics):
    json_str = ReportExporterService.generate_analytics_json(sample_analytics)
    data = json.loads(json_str)

    assert data["total_items_migrated"] == 1250
    assert data["efficiency_percent"] == 99.8


@pytest.mark.asyncio
async def test_audit_export_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request must return 401
        unauth = await client.get("/api/audit/export?format=csv")
        assert unauth.status_code == 401

        # 2. Login as admin
        login_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@telegramhub.local", "password": "admin1234"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Export as CSV
        csv_res = await client.get("/api/audit/export?format=csv", headers=headers)
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers["content-type"]
        assert "attachment" in csv_res.headers["content-disposition"]
        assert "filename=" in csv_res.headers["content-disposition"]
        assert "user_email" in csv_res.text

        # 4. Export as JSON
        json_res = await client.get("/api/audit/export?format=json", headers=headers)
        assert json_res.status_code == 200
        assert "application/json" in json_res.headers["content-type"]
        parsed = json.loads(json_res.text)
        assert isinstance(parsed, list)

        # 5. Export as HTML
        html_res = await client.get("/api/audit/export?format=html", headers=headers)
        assert html_res.status_code == 200
        assert "text/html" in html_res.headers["content-type"]
        assert "inline" in html_res.headers["content-disposition"]
        assert "<!DOCTYPE html>" in html_res.text


@pytest.mark.asyncio
async def test_analytics_export_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Export analytics as CSV
        csv_res = await client.get("/api/analytics/export?format=csv")
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers["content-type"]
        assert "attachment" in csv_res.headers["content-disposition"]
        assert "RESUMEN EJECUTIVO" in csv_res.text

        # Export analytics as JSON
        json_res = await client.get("/api/analytics/export?format=json")
        assert json_res.status_code == 200
        assert "application/json" in json_res.headers["content-type"]
        data = json.loads(json_res.text)
        assert "total_items_migrated" in data
