from __future__ import annotations

import os
from pathlib import Path
import tempfile
import pytest
from httpx import AsyncClient, ASGITransport

from backend.application.services.disaster_recovery_service import DisasterRecoveryService
from backend.infrastructure.persistence.postgres_repository import PostgresRepository
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository
from backend.main import app
from backend.presentation.dependencies import get_disaster_recovery_service


@pytest.mark.asyncio
async def test_disaster_recovery_service_lifecycle():
    with tempfile.TemporaryDirectory() as tmp_dir:
        job_repo = SQLiteJobRepository(db_path=":memory:")
        await job_repo.initialize_schema()

        pg_repo = PostgresRepository()
        await pg_repo.initialize_schema()

        service = DisasterRecoveryService(
            job_repo=job_repo,
            postgres_repo=pg_repo,
            backups_dir=tmp_dir,
        )

        # 1. Initially empty
        initial_list = await service.list_snapshots()
        assert len(initial_list) == 0

        # 2. Create snapshot
        snapshot = await service.create_snapshot(trigger="MANUAL", retention_limit=5)
        assert snapshot["snapshot_id"] is not None
        assert snapshot["filename"].endswith(".tar.gz")
        assert snapshot["total_records"] >= 1  # seeded admin user
        assert snapshot["size_bytes"] > 0
        assert snapshot["sha256"] != ""

        # 3. List should show the snapshot
        listed = await service.list_snapshots()
        assert len(listed) == 1
        assert listed[0]["snapshot_id"] == snapshot["snapshot_id"]

        # 4. Verification dry-run
        verify_res = await service.verify_snapshot(snapshot["snapshot_id"])
        assert verify_res["valid"] is True
        assert verify_res["has_tables_dump"] is True
        assert verify_res["manifest"]["snapshot_id"] == snapshot["snapshot_id"]

        # 5. Get snapshot path
        path = await service.get_snapshot_path(snapshot["snapshot_id"])
        assert path is not None
        assert path.exists()

        # 6. Delete snapshot
        deleted = await service.delete_snapshot(snapshot["snapshot_id"])
        assert deleted is True
        assert not path.exists()

        # 7. List empty again
        after_delete = await service.list_snapshots()
        assert len(after_delete) == 0


@pytest.mark.asyncio
async def test_disaster_recovery_retention_policy():
    with tempfile.TemporaryDirectory() as tmp_dir:
        job_repo = SQLiteJobRepository(db_path=":memory:")
        await job_repo.initialize_schema()
        pg_repo = PostgresRepository()
        await pg_repo.initialize_schema()

        service = DisasterRecoveryService(
            job_repo=job_repo,
            postgres_repo=pg_repo,
            backups_dir=tmp_dir,
        )

        # Create 5 snapshots with retention_limit = 3
        created_ids = []
        for i in range(5):
            snap = await service.create_snapshot(trigger="SCHEDULED", retention_limit=3)
            created_ids.append(snap["snapshot_id"])

        snapshots = await service.list_snapshots()
        # Exactly 3 snapshots should be retained
        assert len(snapshots) == 3

        retained_ids = [s["snapshot_id"] for s in snapshots]
        # Oldest 2 snapshots should be deleted
        assert created_ids[0] not in retained_ids
        assert created_ids[1] not in retained_ids
        # Newest 3 should be kept
        assert created_ids[2] in retained_ids
        assert created_ids[3] in retained_ids
        assert created_ids[4] in retained_ids


@pytest.mark.asyncio
async def test_disaster_recovery_invalid_id_rejection():
    with tempfile.TemporaryDirectory() as tmp_dir:
        service = DisasterRecoveryService(
            job_repo=SQLiteJobRepository(db_path=":memory:"),
            postgres_repo=PostgresRepository(),
            backups_dir=tmp_dir,
        )

        with pytest.raises(ValueError):
            service._sanitize_snapshot_id("../../etc/passwd")

        with pytest.raises(ValueError):
            service._sanitize_snapshot_id("snap;rm -rf /")


@pytest.mark.asyncio
async def test_disaster_recovery_api_endpoints():
    with tempfile.TemporaryDirectory() as tmp_dir:
        job_repo = SQLiteJobRepository(db_path=":memory:")
        await job_repo.initialize_schema()
        pg_repo = PostgresRepository()
        await pg_repo.initialize_schema()

        custom_service = DisasterRecoveryService(
            job_repo=job_repo,
            postgres_repo=pg_repo,
            backups_dir=tmp_dir,
        )

        # Override dependency
        app.dependency_overrides[get_disaster_recovery_service] = lambda: custom_service

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # 1. Unauthenticated request fails with 401
                unauth_res = await client.get("/api/backups")
                assert unauth_res.status_code == 401

                # 2. Login as admin
                login_res = await client.post(
                    "/api/auth/login",
                    json={"email": "admin@telegramhub.local", "password": "admin1234"},
                )
                assert login_res.status_code == 200
                token = login_res.json()["access_token"]
                headers = {"Authorization": f"Bearer {token}"}

                # 3. GET /api/backups (initially empty)
                list_res = await client.get("/api/backups", headers=headers)
                assert list_res.status_code == 200
                data = list_res.json()
                assert data["total_count"] == 0
                assert data["snapshots"] == []

                # 4. POST /api/backups (create backup)
                create_res = await client.post(
                    "/api/backups",
                    json={"trigger": "MANUAL", "retention_limit": 7},
                    headers=headers,
                )
                assert create_res.status_code == 201
                snap_data = create_res.json()
                snapshot_id = snap_data["snapshot_id"]
                assert snapshot_id.startswith("snapshot_")

                # 5. GET /api/backups (now contains 1)
                list_res2 = await client.get("/api/backups", headers=headers)
                assert list_res2.status_code == 200
                assert list_res2.json()["total_count"] == 1

                # 6. POST /api/backups/{id}/verify
                verify_res = await client.post(f"/api/backups/{snapshot_id}/verify", headers=headers)
                assert verify_res.status_code == 200
                assert verify_res.json()["valid"] is True

                # 7. GET /api/backups/{id}/download
                dl_res = await client.get(f"/api/backups/{snapshot_id}/download", headers=headers)
                assert dl_res.status_code == 200
                assert dl_res.headers["content-type"] in ["application/gzip", "application/x-gzip"]
                assert len(dl_res.content) > 0

                # 8. DELETE /api/backups/{id}
                del_res = await client.delete(f"/api/backups/{snapshot_id}", headers=headers)
                assert del_res.status_code == 200
                assert del_res.json()["success"] is True

                # 9. Verify not found after delete
                dl_res_after = await client.get(f"/api/backups/{snapshot_id}/download", headers=headers)
                assert dl_res_after.status_code == 404

        finally:
            app.dependency_overrides.pop(get_disaster_recovery_service, None)
