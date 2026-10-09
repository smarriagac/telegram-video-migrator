from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.channel import Channel
from backend.domain.entities.video_message import VideoMessage
from backend.domain.entities.dialog import TelegramDialog
from backend.domain.entities.chat_message import ChatMessage


class TelegramGatewayPort(ABC):
    """Port defining Telegram MTProto gateway operations."""

    @abstractmethod
    async def get_managed_channels(self) -> list[Channel]:
        """Retrieve channels where authenticated user has management/posting permissions."""
        raise NotImplementedError

    @abstractmethod
    async def fetch_channel_videos(
        self, channel_id: int, after_message_id: int | None = None
    ) -> list[VideoMessage]:
        """Fetch video messages from source channel, optionally after a message ID."""
        raise NotImplementedError

    @abstractmethod
    async def copy_video_by_reference(
        self, target_channel_id: int, video: VideoMessage
    ) -> int:
        """Post video to target channel using MTProto document reference. Returns target message ID."""
        raise NotImplementedError

    @abstractmethod
    async def get_dialogs(self, limit: int = 50) -> list[TelegramDialog]:
        """Retrieve conversation dialogs (users, groups, channels) for authenticated account."""
        raise NotImplementedError

    @abstractmethod
    async def get_chat_messages(
        self, chat_id: int, limit: int = 50
    ) -> list[ChatMessage]:
        """Fetch recent message history from a specific chat."""
        raise NotImplementedError
