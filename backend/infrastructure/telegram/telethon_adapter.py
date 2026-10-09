from __future__ import annotations

import logging
from typing import Any
from telethon import TelegramClient, types
from telethon.errors import (
    FloodWaitError,
    ChatAdminRequiredError,
    ChannelPrivateError,
    UserBannedInChannelError,
)

from backend.domain.entities.channel import Channel
from backend.domain.entities.video_message import VideoMessage
from backend.domain.exceptions.domain_exceptions import (
    ChannelAccessDeniedException,
    FloodWaitDomainException,
)
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort

logger = logging.getLogger(__name__)


class TelethonAdapter(TelegramGatewayPort):
    """Telethon implementation of TelegramGatewayPort using MTProto."""

    def __init__(self, client: TelegramClient) -> None:
        self.client = client

    async def get_managed_channels(self) -> list[Channel]:
        """Retrieve channels where the authenticated user has posting rights."""
        channels: list[Channel] = []
        try:
            async for dialog in self.client.iter_dialogs():
                if not dialog.is_channel:
                    continue

                entity = dialog.entity
                can_post = False
                if getattr(entity, "creator", False):
                    can_post = True
                elif getattr(entity, "admin_rights", None) and entity.admin_rights.post_messages:
                    can_post = True

                channels.append(
                    Channel(
                        id=dialog.id,
                        title=dialog.name or "Untitled Channel",
                        username=getattr(entity, "username", None),
                        can_post=can_post,
                    )
                )
            return channels
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.error(f"Error fetching managed channels: {e}")
            raise

    async def fetch_channel_videos(
        self, channel_id: int, after_message_id: int | None = None
    ) -> list[VideoMessage]:
        """Fetch video messages sequentially from channel."""
        videos: list[VideoMessage] = []
        min_id = after_message_id or 0
        try:
            async for message in self.client.iter_messages(channel_id, min_id=min_id, reverse=True):
                if not message.media or not hasattr(message.media, "document"):
                    continue

                doc = message.media.document
                is_video = False
                if getattr(doc, "mime_type", "").startswith("video/"):
                    is_video = True
                elif any(isinstance(attr, types.DocumentAttributeVideo) for attr in getattr(doc, "attributes", [])):
                    is_video = True

                if not is_video:
                    continue

                # Serialize formatting entities if present
                entities_data: list[dict[str, Any]] = []
                if message.entities:
                    for ent in message.entities:
                        entities_data.append(ent.to_dict())

                videos.append(
                    VideoMessage(
                        message_id=message.id,
                        input_document_id=doc.id,
                        access_hash=doc.access_hash,
                        file_reference=doc.file_reference,
                        caption=message.message or "",
                        entities=entities_data,
                    )
                )
            return videos
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e

    async def copy_video_by_reference(
        self, target_channel_id: int, video: VideoMessage
    ) -> int:
        """Post existing video to target channel using MTProto document reference.
        
        Zero file bytes are uploaded or downloaded; Telegram links the existing document.
        Does NOT set forward headers, generating a fresh clean message with original caption.
        """
        input_doc = types.InputDocument(
            id=video.input_document_id,
            access_hash=video.access_hash,
            file_reference=video.file_reference,
        )

        try:
            # Reconstruct Telethon formatting entities if present
            raw_entities = None
            if video.entities:
                raw_entities = []
                for ent_dict in video.entities:
                    try:
                        raw_entities.append(types.TypeMessageEntity.from_dict(ent_dict))
                    except Exception:
                        pass

            sent_msg = await self.client.send_file(
                target_channel_id,
                file=input_doc,
                caption=video.caption or "",
                formatting_entities=raw_entities,
            )
            return sent_msg.id
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
