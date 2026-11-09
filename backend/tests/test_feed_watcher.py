from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.testclient import TestClient

from backend.domain.entities.feed_source import FeedSource
from backend.domain.entities.user import User
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository
from backend.application.services.feed_watcher_service import FeedWatcherService
from backend.main import app
from backend.presentation.dependencies import get_current_user, get_job_repository


def test_feed_source_entity():
    source = FeedSource(
        id="feed-123",
        title="Tech News TikTok",
        source_url="https://tiktok.com/@technews",
        platform="tiktok",
        target_channel_id=-10011223344,
        check_interval_minutes=30,
        pipeline_config={
            "aspect_ratio_mode": "9:16_BLUR",
            "burn_subtitles": True,
            "subtitle_style": "KINETIC_YELLOW",
            "slice_stories": True,
            "generate_thumbnail": True,
        },
    )
    d = source.to_dict()
    assert d["id"] == "feed-123"
    assert d["title"] == "Tech News TikTok"
    assert d["check_interval_minutes"] == 30
    assert d["pipeline_config"]["burn_subtitles"] is True

    reconstituted = FeedSource.from_row(d)
    assert reconstituted.id == "feed-123"
    assert reconstituted.pipeline_config["aspect_ratio_mode"] == "9:16_BLUR"


@pytest.mark.asyncio
async def test_sqlite_feed_source_repository_crud(tmp_path):
    db_file = str(tmp_path / "test_feeds.db")
    repo = SQLiteJobRepository(db_path=db_file)
    await repo.initialize_schema()

    source = FeedSource(
        id="src-abc",
        tenant_id="tenant-1",
        title="Reels Daily",
        source_url="https://instagram.com/reels/daily",
        platform="instagram",
        target_channel_id=-100998877,
        is_active=True,
    )

    created = await repo.create_feed_source(source)
    assert created.id == "src-abc"

    retrieved = await repo.get_feed_source("src-abc")
    assert retrieved is not None
    assert retrieved.title == "Reels Daily"
    assert retrieved.target_channel_id == -100998877

    sources = await repo.list_feed_sources(tenant_id="tenant-1")
    assert len(sources) == 1

    retrieved.total_ingested = 5
    retrieved.last_video_id = "vid-999"
    updated = await repo.update_feed_source(retrieved)
    assert updated.total_ingested == 5

    check_updated = await repo.get_feed_source("src-abc")
    assert check_updated.last_video_id == "vid-999"

    del_res = await repo.delete_feed_source("src-abc")
    assert del_res is True
    assert await repo.get_feed_source("src-abc") is None


@pytest.mark.asyncio
async def test_feed_watcher_service_poll(tmp_path):
    repo = MagicMock()
    repo.update_feed_source = AsyncMock(return_value=None)
    mock_ingestion = MagicMock()
    mock_ingestion.ingest = AsyncMock(return_value={"success": True, "message_id": 101})

    service = FeedWatcherService(repository=repo, ingestion_service=mock_ingestion)

    source = FeedSource(
        id="feed-test",
        title="Creator Feed",
        source_url="https://tiktok.com/@creator",
        target_channel_id=-10012345,
        last_video_id="old-video-001",
    )

    fake_entries = [
        {"id": "new-video-003", "url": "https://tiktok.com/@creator/video/003", "title": "New Video 3"},
        {"id": "new-video-002", "url": "https://tiktok.com/@creator/video/002", "title": "New Video 2"},
        {"id": "old-video-001", "url": "https://tiktok.com/@creator/video/001", "title": "Old Video 1"},
    ]

    with patch.object(service, "extract_recent_entries", return_value=fake_entries):
        res = await service.poll_source(source)

        assert res["status"] == "SUCCESS"
        assert res["ingested_count"] == 2
        assert source.total_ingested == 2
        assert source.last_video_id == "new-video-003"
        assert mock_ingestion.ingest.call_count == 2
        repo.update_feed_source.assert_called_once_with(source)


def test_feed_watcher_api_endpoints():
    mock_user = User(
        id=1,
        email="feed_admin@telegramhub.local",
        password_hash="hash",
        role="admin",
        is_active=True,
        tenant_id="default",
    )
    mock_repo = MagicMock()
    source_store: dict[str, FeedSource] = {}

    async def mock_create(s: FeedSource):
        source_store[s.id] = s
        return s

    async def mock_get(sid: str):
        return source_store.get(sid)

    async def mock_list(tenant_id="default", active_only=False):
        return list(source_store.values())

    async def mock_update(s: FeedSource):
        source_store[s.id] = s
        return s

    async def mock_delete(sid: str):
        if sid in source_store:
            del source_store[sid]
            return True
        return False

    mock_repo.create_feed_source = AsyncMock(side_effect=mock_create)
    mock_repo.get_feed_source = AsyncMock(side_effect=mock_get)
    mock_repo.list_feed_sources = AsyncMock(side_effect=mock_list)
    mock_repo.update_feed_source = AsyncMock(side_effect=mock_update)
    mock_repo.delete_feed_source = AsyncMock(side_effect=mock_delete)

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_job_repository] = lambda: mock_repo

    client = TestClient(app)

    try:
        # 1. Create feed source
        create_res = client.post(
            "/api/feeds",
            json={
                "title": "Viral Memes",
                "source_url": "https://tiktok.com/@viralmemes",
                "platform": "tiktok",
                "target_channel_id": -10055443322,
                "check_interval_minutes": 15,
                "pipeline_config": {
                    "aspect_ratio_mode": "9:16_BLUR",
                    "burn_subtitles": True,
                    "mode": "RESERVOIR",
                },
            },
        )
        assert create_res.status_code == 201
        created_data = create_res.json()
        assert created_data["success"] is True
        feed_id = created_data["feed"]["id"]

        # 2. List feed sources
        list_res = client.get("/api/feeds")
        assert list_res.status_code == 200
        assert list_res.json()["total"] == 1

        # 3. Toggle feed active state
        toggle_res = client.patch(f"/api/feeds/{feed_id}/toggle")
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_active"] is False

        # 4. Delete feed source
        del_res = client.delete(f"/api/feeds/{feed_id}")
        assert del_res.status_code == 200
        assert del_res.json()["deleted_id"] == feed_id

        # Verify deletion
        list_after = client.get("/api/feeds")
        assert list_after.json()["total"] == 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_job_repository, None)
