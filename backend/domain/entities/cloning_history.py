from __future__ import annotations

from dataclasses import dataclass, field
from backend.domain.entities.migration_job import MigrationJob


@dataclass
class ClonedContentItem:
    """Represents an individual message/media item that was successfully cloned."""

    job_id: str
    source_message_id: int
    target_message_id: int | None
    media_type: str
    caption: str
    migrated_at: str | None
    target_channel_id: int
    target_channel_title: str | None = None


@dataclass
class ChannelCloningHistory:
    """Audit summary of how many times a channel was cloned and its scope."""

    channel_id: int
    total_clones: int
    has_full_clone: bool
    total_items_cloned: int
    jobs: list[MigrationJob] = field(default_factory=list)
