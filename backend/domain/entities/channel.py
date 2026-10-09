from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Channel:
    """Represents a Telegram channel entity."""

    id: int
    title: str
    username: str | None = None
    can_post: bool = False
