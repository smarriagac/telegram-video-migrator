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
from backend.domain.entities.dialog import TelegramDialog
from backend.domain.entities.chat_message import ChatMessage
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

    async def _ensure_connected(self) -> None:
        if not self.client.is_connected():
            await self.client.connect()
        if not await self.client.is_user_authorized():
            raise ChannelAccessDeniedException(
                "La cuenta de Telegram no está autorizada. Por favor vinculá una sesión válida en Configuración o con el script."
            )

    async def get_managed_channels(self) -> list[Channel]:
        """Retrieve channels where the authenticated user has posting rights."""
        channels: list[Channel] = []
        try:
            await self._ensure_connected()
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

    async def get_dialogs(self, limit: int = 50) -> list[TelegramDialog]:
        """Retrieve conversation dialogs (users, groups, channels) for authenticated account."""
        dialogs_list: list[TelegramDialog] = []
        try:
            await self._ensure_connected()
            async for dialog in self.client.iter_dialogs(limit=limit):
                if dialog.is_user:
                    chat_type = "user"
                elif dialog.is_group:
                    chat_type = "group"
                elif dialog.is_channel:
                    chat_type = "channel"
                else:
                    chat_type = "user"

                last_msg_text = None
                last_msg_date = None
                if dialog.message:
                    last_msg_text = dialog.message.message or (
                        "[Video]" if getattr(dialog.message, "video", None) else "[Archivo/Foto]"
                    )
                    if dialog.message.date:
                        last_msg_date = dialog.message.date.strftime("%H:%M")

                colors = ["bg-cyan-500", "bg-emerald-500", "bg-purple-500", "bg-blue-500", "bg-amber-500"]
                avatar_color = colors[abs(dialog.id) % len(colors)]

                dialogs_list.append(
                    TelegramDialog(
                        id=dialog.id,
                        title=dialog.name or "Sin título",
                        type=chat_type,
                        unread_count=dialog.unread_count or 0,
                        last_message=last_msg_text,
                        last_message_date=last_msg_date,
                        avatar_color=avatar_color,
                    )
                )
            return dialogs_list
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.error(f"Error fetching dialogs: {e}")
            raise

    async def get_chat_messages(
        self, chat_id: int, limit: int = 50
    ) -> list[ChatMessage]:
        """Fetch recent message history from a specific chat in chronological order."""
        messages_list: list[ChatMessage] = []
        try:
            async for msg in self.client.iter_messages(chat_id, limit=limit):
                sender_name = "Desconocido"
                if msg.sender:
                    first = getattr(msg.sender, "first_name", "") or ""
                    last = getattr(msg.sender, "last_name", "") or ""
                    title = getattr(msg.sender, "title", "") or ""
                    sender_name = f"{first} {last}".strip() or title or "Usuario"
                elif getattr(msg, "post", False):
                    sender_name = "Canal"

                media_type = None
                if getattr(msg, "video", None):
                    media_type = "video"
                elif getattr(msg, "photo", None):
                    media_type = "photo"
                elif getattr(msg, "document", None):
                    media_type = "document"

                date_str = msg.date.strftime("%H:%M") if msg.date else ""

                messages_list.append(
                    ChatMessage(
                        id=msg.id,
                        chat_id=chat_id,
                        sender_id=msg.sender_id or 0,
                        sender_name=sender_name,
                        text=msg.message or (f"[{media_type.capitalize()}]" if media_type else ""),
                        date=date_str,
                        is_outgoing=bool(msg.out),
                        media_type=media_type,
                    )
                )
            messages_list.reverse()
            return messages_list
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error fetching chat messages for chat {chat_id}: {e}")
            raise
