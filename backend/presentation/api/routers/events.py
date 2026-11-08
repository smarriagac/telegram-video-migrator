from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import AsyncIterator
from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from backend.application.broadcaster import EventBroadcaster
from backend.presentation.dependencies import get_broadcaster

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/events", tags=["Real-Time Events"])


@router.get("/stream")
async def global_event_stream(
    broadcaster: EventBroadcaster = Depends(get_broadcaster),
) -> EventSourceResponse:
    """Unified Server-Sent Events (SSE) multiplexed stream for real-time job progress and notifications."""

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        # 1. Send initial connection confirmation
        yield {
            "event": "message",
            "data": json.dumps(
                {
                    "type": "CONNECTED",
                    "data": {
                        "status": "connected",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                }
            ),
        }

        # 2. Subscribe to global_events topic with auto_close=False
        stream = broadcaster.subscribe("global_events", auto_close=False)
        stream_iter = aiter(stream)

        try:
            while True:
                try:
                    # Wait for next event or trigger heartbeat ping after 15 seconds
                    event = await asyncio.wait_for(anext(stream_iter), timeout=15.0)
                    yield {
                        "event": "message",
                        "data": json.dumps(event),
                    }
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat ping to prevent proxy/browser timeout
                    yield {
                        "event": "ping",
                        "data": json.dumps(
                            {"timestamp": datetime.now(timezone.utc).isoformat()}
                        ),
                    }
        except (asyncio.CancelledError, GeneratorExit):
            logger.debug("Client disconnected from global SSE stream.")
        except Exception as e:
            logger.warning(f"Error in global SSE event generator: {e}")

    return EventSourceResponse(event_generator())
