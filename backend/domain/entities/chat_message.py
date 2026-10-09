from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ChatMessage:
    """Represents an individual message in a chat thread."""

    id: int
    chat_id: int
    sender_id: int
    sender_name: str
    text: str
    date: str
    is_outgoing: bool = False
    media_type: str | None = None
