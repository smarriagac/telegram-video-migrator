from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.channel import Channel
from backend.domain.entities.video_message import VideoMessage


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
