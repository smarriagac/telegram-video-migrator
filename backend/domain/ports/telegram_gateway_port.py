from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.channel import Channel
from backend.domain.entities.video_message import VideoMessage
from backend.domain.entities.dialog import TelegramDialog
from backend.domain.entities.chat_message import ChatMessage
from backend.domain.entities.channel_message import ChannelMessage


class TelegramGatewayPort(ABC):
    """Port defining Telegram MTProto gateway operations."""

    @abstractmethod
    async def get_managed_channels(
        self, limit: int = 100, account_id: int | None = None
    ) -> list[Channel]:
        """Retrieve channels where authenticated user has management/posting permissions."""
        raise NotImplementedError

    @abstractmethod
    async def get_channel_messages(
        self, channel_id: int, limit: int = 50, offset_id: int | None = None, account_id: int | None = None
    ) -> list[ChannelMessage]:
        """Fetch preview messages from a channel for user selection."""
        raise NotImplementedError

    @abstractmethod
    async def get_message_thumbnail(
        self, channel_id: int, message_id: int, repo: Any = None, account_id: int | None = None
    ) -> bytes | None:
        """Retrieve small image thumbnail for a specific channel message."""
        raise NotImplementedError

    async def get_message_media_for_streaming(
        self, channel_id: int, message_id: int, repo: Any = None, account_id: int | None = None
    ) -> tuple[Any, Any, int, str] | None:
        """Fetch client, media object, file size, and mime type for video streaming."""
        return None

    async def stream_media_range(
        self, client: Any, media: Any, start: int, length: int, chunk_size: int = 256 * 1024
    ):
        """Asynchronously stream chunks of bytes for a media object starting at offset."""
        if False:
            yield b""

    @abstractmethod
    async def fetch_channel_videos(
        self, channel_id: int, after_message_id: int | None = None, account_id: int | None = None
    ) -> list[VideoMessage]:
        """Fetch video messages from source channel, optionally after a message ID."""
        raise NotImplementedError

    @abstractmethod
    async def copy_video_by_reference(
        self, target_channel_id: int, video: VideoMessage, account_id: int | None = None
    ) -> int:
        """Post video to target channel using MTProto document reference. Returns target message ID."""
        raise NotImplementedError

    @abstractmethod
    async def copy_media_cross_account(
        self,
        source_channel_id: int,
        target_channel_id: int,
        video: VideoMessage,
        source_account_id: int,
        target_account_id: int,
    ) -> int:
        """Bridge copy media between different accounts using temporary streaming buffer."""
        raise NotImplementedError

    @abstractmethod
    async def get_dialogs(
        self, limit: int = 50, account_id: int | None = None
    ) -> list[TelegramDialog]:
        """Retrieve conversation dialogs (users, groups, channels) for authenticated account."""
        raise NotImplementedError

    @abstractmethod
    async def get_chat_messages(
        self, chat_id: int, limit: int = 50
    ) -> list[ChatMessage]:
        """Fetch recent message history from a specific chat."""
        raise NotImplementedError

    async def mark_dialog_as_read(
        self, chat_id: int, max_id: int | None = None, account_id: int | None = None
    ) -> bool:
        """Mark dialog messages up to max_id as read in Telegram MTProto."""
        return True

    @abstractmethod
    async def send_local_media(
        self, channel_id: int, file_path: str, caption: str | None = None
    ) -> ChannelMessage:
        """Upload and post a local media file (video/photo/doc) directly to a channel."""
        raise NotImplementedError

    @abstractmethod
    async def send_text_message(
        self, channel_id: int, text: str
    ) -> ChannelMessage:
        """Send a plain text message to a channel."""
        raise NotImplementedError

    @abstractmethod
    async def delete_channel_message(
        self, channel_id: int, message_id: int
    ) -> bool:
        """Delete a message from a channel."""
        raise NotImplementedError

    @abstractmethod
    async def edit_channel_message(
        self, channel_id: int, message_id: int, text: str
    ) -> ChannelMessage:
        """Edit the caption or text of an existing channel message."""
        raise NotImplementedError

    async def kick_chat_member(
        self, channel_id: int, user_id: int, account_id: int | None = None
    ) -> bool:
        """Kick/remove a member from a channel or supergroup."""
        return False

    async def create_channel_invite_link(
        self, channel_id: int, expire_date: int | None = None, member_limit: int = 1, account_id: int | None = None
    ) -> str:
        """Create a single-use or expiring invite link for a channel."""
        return ""
