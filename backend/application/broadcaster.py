from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator

logger = logging.getLogger(__name__)


class EventBroadcaster:
    """In-memory pub-sub event broadcaster for job progress updates."""

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, job_id: str) -> AsyncIterator[dict[str, Any]]:
        """Subscribe to events for a specific job ID as an async generator."""
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            if job_id not in self._subscribers:
                self._subscribers[job_id] = set()
            self._subscribers[job_id].add(queue)

        try:
            while True:
                event = await queue.get()
                yield event
                if event.get("status") in {"COMPLETED", "FAILED", "CANCELLED"}:
                    break
        finally:
            async with self._lock:
                if job_id in self._subscribers:
                    self._subscribers[job_id].discard(queue)
                    if not self._subscribers[job_id]:
                        del self._subscribers[job_id]

    async def publish(self, job_id: str, event: dict[str, Any]) -> None:
        """Broadcast an event payload to all active subscribers of the job."""
        async with self._lock:
            queues = list(self._subscribers.get(job_id, set()))

        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(f"Subscriber queue full for job {job_id}, dropping event.")


broadcaster = EventBroadcaster()
