from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.domain.entities.sync_binding import ChannelSyncBinding
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.presentation.dependencies import get_job_repository, get_live_sync_service


class MockJobRepository:
    def __init__(self):
        self.bindings = [
            ChannelSyncBinding(
                source_channel_id=-100111,
                target_channel_id=-100222,
                source_channel_title="Source A",
                target_channel_title="Target B",
                is_active=True,
                last_synced_message_id=42,
            )
        ]

    async def get_analytics_summary(self):
        return {
            "total_items_migrated": 150,
            "total_bandwidth_saved_bytes": 150 * 26214400,
            "duplicates_prevented": 12,
            "total_jobs": 10,
            "jobs_by_status": {"COMPLETED": 8, "FAILED": 2},
            "active_sync_bindings": 1,
            "media_type_distribution": {"video": 100, "photo": 50},
            "daily_volume": [{"date": "2026-11-01", "count": 150, "estimated_mb": 3750.0}],
            "efficiency_percent": 99.8,
        }

    async def list_sync_bindings(self):
        return list(self.bindings)

    async def get_sync_binding(self, source_channel_id: int, target_channel_id: int):
        for b in self.bindings:
            if b.source_channel_id == source_channel_id and b.target_channel_id == target_channel_id:
                return b
        return None

    async def save_sync_binding(self, binding: ChannelSyncBinding):
        for idx, b in enumerate(self.bindings):
            if b.source_channel_id == binding.source_channel_id and b.target_channel_id == binding.target_channel_id:
                self.bindings[idx] = binding
                return binding
        self.bindings.append(binding)
        return binding

    async def delete_sync_binding(self, source_channel_id: int, target_channel_id: int):
        self.bindings = [
            b for b in self.bindings
            if not (b.source_channel_id == source_channel_id and b.target_channel_id == target_channel_id)
        ]
        return True


class MockLiveSyncService:
    def __init__(self, repo: MockJobRepository):
        self.repo = repo

    async def set_binding(self, **kwargs):
        binding = ChannelSyncBinding(
            source_channel_id=kwargs["source_channel_id"],
            target_channel_id=kwargs["target_channel_id"],
            source_channel_title=kwargs.get("source_title"),
            target_channel_title=kwargs.get("target_title"),
            is_active=kwargs.get("is_active", True),
            caption_rules=kwargs.get("caption_rules"),
            media_filter_rules=kwargs.get("media_filter_rules"),
        )
        return await self.repo.save_sync_binding(binding)

    async def delete_binding(self, source_channel_id: int, target_channel_id: int):
        return await self.repo.delete_sync_binding(source_channel_id, target_channel_id)

    async def reload_bindings(self):
        pass

    def attach_client_listeners(self):
        pass

    def get_health_status(self):
        return {
            "is_running": True,
            "active_sources_count": len(self.repo.bindings),
            "active_bindings_count": len(self.repo.bindings),
            "attached_clients_count": 2,
            "queue_depth": 0,
        }


@pytest.mark.asyncio
async def test_analytics_overview_endpoint():
    repo = MockJobRepository()
    app.dependency_overrides[get_job_repository] = lambda: repo
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/analytics/overview")
            assert res.status_code == 200
            data = res.json()
            assert data["total_items_migrated"] == 150
            assert data["total_bandwidth_saved_gb"] > 0
            assert data["duplicates_prevented"] == 12
            assert data["efficiency_percent"] == 99.8
            assert len(data["daily_volume"]) == 1
    finally:
        app.dependency_overrides.pop(get_job_repository, None)


@pytest.mark.asyncio
async def test_sync_endpoints_lifecycle():
    repo = MockJobRepository()
    mock_svc = MockLiveSyncService(repo)
    app.dependency_overrides[get_job_repository] = lambda: repo
    app.dependency_overrides[get_live_sync_service] = lambda: mock_svc
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Health check
            health_res = await client.get("/api/sync/health")
            assert health_res.status_code == 200
            assert health_res.json()["is_running"] is True

            # 2. List bindings
            list_res = await client.get("/api/sync/bindings")
            assert list_res.status_code == 200
            bindings = list_res.json()
            assert len(bindings) == 1
            assert bindings[0]["source_channel_id"] == -100111

            # 3. Create binding
            new_binding = {
                "source_channel_id": -100333,
                "target_channel_id": -100444,
                "source_channel_title": "Channel X",
                "target_channel_title": "Channel Y",
                "is_active": True,
            }
            create_res = await client.post("/api/sync/bindings", json=new_binding)
            assert create_res.status_code == 201
            assert create_res.json()["source_channel_id"] == -100333

            # 4. Patch binding (toggle paused)
            patch_res = await client.patch("/api/sync/bindings/-100333/-100444", json={"is_active": False})
            assert patch_res.status_code == 200
            assert patch_res.json()["is_active"] is False

            # 5. Delete binding
            del_res = await client.delete("/api/sync/bindings/-100333/-100444")
            assert del_res.status_code == 204

            # Verify deletion
            verify_res = await client.get("/api/sync/bindings")
            assert len(verify_res.json()) == 1
    finally:
        app.dependency_overrides.pop(get_job_repository, None)
        app.dependency_overrides.pop(get_live_sync_service, None)
