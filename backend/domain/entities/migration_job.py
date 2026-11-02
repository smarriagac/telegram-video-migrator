from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class JobStatus(str, Enum):
    """Lifecycle statuses of a video migration job."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSED_FLOOD_WAIT = "PAUSED_FLOOD_WAIT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class MigrationJob:
    """Represents a channel video migration job."""

    job_id: str
    source_id: int
    target_id: int
    status: JobStatus = JobStatus.PENDING
    total_videos: int = 0
    processed_videos: int = 0
    last_processed_id: int | None = None
    created_at: str | None = None
    updated_at: str | None = None
    is_full_migration: bool = True
    source_title: str | None = None
    target_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    caption_rules: dict | None = None
    drip_delay_seconds: int = 0
    media_filter_rules: dict | None = None
