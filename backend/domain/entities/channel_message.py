from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ChannelMessage:
    """Represents a message preview in a channel for selection before migration."""

    id: int
    channel_id: int
    text: str
    media_type: str | None = None  # "video", "photo", "document", "text"
    date: str = ""
    file_size: int | None = None
    views: int | None = None
    is_migrated: bool = False
