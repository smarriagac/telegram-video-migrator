import asyncio
import json
import pytest
from httpx import AsyncClient, ASGITransport

from backend.application.broadcaster import EventBroadcaster
from backend.main import app
from backend.presentation.dependencies import get_broadcaster


@pytest.mark.asyncio
async def test_event_broadcaster_multiplexed_subscriptions():
    """Verify broadcaster handles multiple subscribers with persistent auto_close=False."""
    broadcaster = EventBroadcaster()

    stream1 = broadcaster.subscribe("global_events", auto_close=False)
    stream2 = broadcaster.subscribe("global_events", auto_close=False)

    iter1 = aiter(stream1)
    iter2 = aiter(stream2)

    # Start consuming tasks so the generator enters the loop and registers queues
    t1 = asyncio.create_task(anext(iter1))
    t2 = asyncio.create_task(anext(iter2))
    await asyncio.sleep(0.02)

    # Publish an event
    test_event = {"type": "NOTIFICATION_UPDATE", "data": {"action": "NEW", "id": "notif-123"}}
    await broadcaster.publish("global_events", test_event)

    received1 = await asyncio.wait_for(t1, timeout=2.0)
    received2 = await asyncio.wait_for(t2, timeout=2.0)

    assert received1 == test_event
    assert received2 == test_event


@pytest.mark.asyncio
async def test_events_stream_endpoint():
    """Verify GET /api/events/stream delivers initial handshake and broadcasts."""
    test_broadcaster = EventBroadcaster()
    app.dependency_overrides[get_broadcaster] = lambda: test_broadcaster

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            async with client.stream("GET", "/api/events/stream") as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers.get("content-type", "")

                lines = []
                # Read initial lines
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        payload = json.loads(line.replace("data:", "").strip())
                        lines.append(payload)
                        break

                assert len(lines) == 1
                assert lines[0]["type"] == "CONNECTED"
    finally:
        app.dependency_overrides.pop(get_broadcaster, None)
