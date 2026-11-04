from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TelegramDialog:
    """Represents a Telegram chat dialog (user, group, channel)."""

    id: int
    title: str
    type: str  # "user" | "group" | "channel"
    unread_count: int = 0
    last_message: str | None = None
    last_message_date: str | None = None
    avatar_color: str | None = None
    can_post: bool = True
    read_inbox_max_id: int = 0
    read_outbox_max_id: int = 0
    username: str | None = None
    account_id: int | None = None
    participants_count: int | None = None
    online_count: int | None = None
    is_creator: bool = False
    is_admin: bool = False
    is_online: bool | None = None
    status_text: str | None = None
