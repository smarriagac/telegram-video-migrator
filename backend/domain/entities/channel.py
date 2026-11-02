from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Channel:
    """Represents a Telegram channel or group entity."""

    id: int
    title: str
    username: str | None = None
    can_post: bool = False
    account_id: int | None = None
    account_name: str | None = None
    type: str = "channel"
