from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class CampaignStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ReservoirItemStatus(str, Enum):
    QUEUED = "QUEUED"
    RELEASED = "RELEASED"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


@dataclass
class DripCampaign:
    """Represents a scheduled Content Reservoir drip campaign."""

    id: str
    title: str
    source_channel_id: int
    target_channel_id: int
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    status: CampaignStatus = CampaignStatus.ACTIVE
    interval_minutes: int = 60
    batch_size: int = 1
    jitter_seconds: int = 0
    daily_window_start: str | None = None  # e.g. "09:00"
    daily_window_end: str | None = None  # e.g. "22:00"
    caption_rules: dict[str, Any] | None = None
    next_release_at: str | None = None
    total_items: int = 0
    released_items: int = 0
    failed_items: int = 0
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


@dataclass
class ReservoirItem:
    """Represents an individual media item staged in the Content Reservoir."""

    id: str
    campaign_id: str
    source_message_id: int
    media_type: str = "video"
    file_id: str | None = None
    original_caption: str = ""
    transformed_caption: str = ""
    status: ReservoirItemStatus = ReservoirItemStatus.QUEUED
    scheduled_at: str = ""
    released_at: str | None = None
    published_message_id: int | None = None
    error_message: str | None = None
    position: int = 0
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
