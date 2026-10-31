from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class QueueItemStatus(str, Enum):
    """Execution status for individual queue items."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


@dataclass
class QueueItem:
    """Represents a discrete queued unit of message migration."""

    job_id: str
    source_message_id: int
    status: QueueItemStatus = QueueItemStatus.PENDING
    media_type: str = "video"
    caption: str = ""
    target_message_id: int | None = None
    error_message: str | None = None
    retry_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None
