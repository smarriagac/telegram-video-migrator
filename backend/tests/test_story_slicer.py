from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.application.services.story_slicer_engine import (
    StorySlicerEngine,
    StorySegment,
)
from backend.application.services.media_ingestion_service import MediaIngestionService
from backend.domain.entities.user import User, Role
from backend.main import app
from backend.presentation.dependencies import get_current_user


@pytest.fixture
def test_user() -> User:
    return User(
        id="user_admin",
        email="admin@example.com",
        password_hash="fake_hash",
        role=Role.ADMIN,
        tenant_id="tenant_default",
    )


def test_compute_slice_plan_short_video():
    # 45s video -> No slicing needed
    plan = StorySlicerEngine.compute_slice_plan(45.0, max_segment_seconds=60.0)
    assert len(plan) == 1
    assert plan[0] == (0.0, 45.0)


def test_compute_slice_plan_exact_multiples():
    # 120s video -> Exactly 2 slices of 60s
    plan = StorySlicerEngine.compute_slice_plan(120.0, max_segment_seconds=60.0)
    assert len(plan) == 2
    assert plan[0] == (0.0, 60.0)
    assert plan[1] == (60.0, 120.0)


def test_compute_slice_plan_balanced_tail():
    # 65s video -> Within 60 + 8 threshold, balanced into 2 equal parts
    plan = StorySlicerEngine.compute_slice_plan(65.0, max_segment_seconds=60.0)
    assert len(plan) == 2
    assert plan[0][0] == 0.0
    assert plan[1][1] == 65.0
    assert plan[0][1] == plan[1][0]


def test_compute_slice_plan_three_parts():
    # 150s video -> 3 parts: [0-60], [60-120], [120-150]
    plan = StorySlicerEngine.compute_slice_plan(150.0, max_segment_seconds=60.0)
    assert len(plan) == 3
    assert plan[0] == (0.0, 60.0)
    assert plan[1] == (60.0, 120.0)
    assert plan[2] == (120.0, 150.0)


def test_format_segment_caption():
    # Single segment -> unchanged
    cap1 = StorySlicerEngine.format_segment_caption("Amazing Reel", 1, 1)
    assert cap1 == "Amazing Reel"

    # Multi-part -> appends sequential label
    cap2 = StorySlicerEngine.format_segment_caption("Amazing Reel", 2, 3)
    assert "Amazing Reel" in cap2
    assert "(Parte 2/3)" in cap2


def test_api_slice_plan_endpoint(test_user):
    app.dependency_overrides[get_current_user] = lambda: test_user
    client = TestClient(app)

    try:
        resp = client.post(
            "/api/video-processing/slice-plan",
            json={"duration_s": 130.0, "max_segment_seconds": 60.0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["total_segments"] == 3
        assert len(data["intervals"]) == 3
        assert data["intervals"][0]["part"] == 1
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_media_ingestion_with_album_slicing():
    mock_client = AsyncMock()
    mock_gateway = MagicMock()
    mock_gateway._get_client.return_value = mock_client
    mock_gateway._ensure_connected = AsyncMock()

    sent_msg1 = MagicMock(id=101)
    sent_msg2 = MagicMock(id=102)
    mock_client.send_file = AsyncMock(return_value=[sent_msg1, sent_msg2])
    mock_client.get_input_entity = AsyncMock(return_value=MagicMock())

    service = MediaIngestionService(
        gateway_provider=lambda tenant_id: mock_gateway,
    )

    mock_segments = [
        StorySegment(1, 2, 0.0, 60.0, 60.0, "/tmp/part1.mp4", "Caption (Parte 1/2)"),
        StorySegment(2, 2, 60.0, 120.0, 60.0, "/tmp/part2.mp4", "Caption (Parte 2/2)"),
    ]

    with patch.object(
        MediaIngestionService,
        "download_media",
        return_value=("/tmp/fake.mp4", {"title": "Long Video", "platform": "tiktok"}),
    ):
        with patch.object(StorySlicerEngine, "slice_video", return_value=mock_segments):
            res = await service.ingest(
                tenant_id="tenant_1",
                url="https://tiktok.com/@user/video/123",
                target_channel_id=987654,
                mode="DIRECT",
                slice_stories=True,
                slice_dispatch_mode="ALBUM",
            )
            assert res["success"] is True
            assert res["dispatch"] == "ALBUM"
            assert res["segments_count"] == 2
            mock_client.send_file.assert_called_once()
            # Verify file parameter was passed as a list of segment paths
            call_kwargs = mock_client.send_file.call_args.kwargs
            assert call_kwargs["file"] == ["/tmp/part1.mp4", "/tmp/part2.mp4"]


@pytest.mark.asyncio
async def test_media_ingestion_with_sequential_slicing():
    mock_client = AsyncMock()
    mock_gateway = MagicMock()
    mock_gateway._get_client.return_value = mock_client
    mock_gateway._ensure_connected = AsyncMock()

    sent_msg1 = MagicMock(id=201)
    sent_msg2 = MagicMock(id=202)
    mock_client.send_file = AsyncMock(side_effect=[sent_msg1, sent_msg2])
    mock_client.get_input_entity = AsyncMock(return_value=MagicMock())

    service = MediaIngestionService(
        gateway_provider=lambda tenant_id: mock_gateway,
    )

    mock_segments = [
        StorySegment(1, 2, 0.0, 60.0, 60.0, "/tmp/part1.mp4", "Caption (Parte 1/2)"),
        StorySegment(2, 2, 60.0, 120.0, 60.0, "/tmp/part2.mp4", "Caption (Parte 2/2)"),
    ]

    with patch.object(
        MediaIngestionService,
        "download_media",
        return_value=("/tmp/fake.mp4", {"title": "Long Video", "platform": "tiktok"}),
    ):
        with patch.object(StorySlicerEngine, "slice_video", return_value=mock_segments):
            res = await service.ingest(
                tenant_id="tenant_1",
                url="https://tiktok.com/@user/video/123",
                target_channel_id=987654,
                mode="DIRECT",
                slice_stories=True,
                slice_dispatch_mode="SEQUENTIAL",
            )
            assert res["success"] is True
            assert res["dispatch"] == "SEQUENTIAL"
            assert res["segments_count"] == 2
            assert mock_client.send_file.call_count == 2
