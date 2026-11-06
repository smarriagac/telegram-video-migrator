from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ChannelSyncBinding:
    """Represents a real-time auto-synchronization binding between source and target channels."""

    source_channel_id: int
    target_channel_id: int
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    is_active: bool = True
    last_synced_message_id: int = 0
    created_at: str | None = None
    updated_at: str | None = None
    caption_rules: dict | None = None
    media_filter_rules: dict | None = None
    status: str = "ACTIVE"
    last_error: str | None = None
