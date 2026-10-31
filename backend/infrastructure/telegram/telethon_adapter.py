from __future__ import annotations

import logging
from pathlib import Path
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
from backend.domain.entities.channel_message import ChannelMessage
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

    async def get_managed_channels(self, limit: int = 100) -> list[Channel]:
        """Retrieve channels where the authenticated user has posting rights."""
        channels: list[Channel] = []
        try:
            await self._ensure_connected()
            scan_limit = max(limit * 2, 250)
            dialogs = await self.client.get_dialogs(limit=scan_limit)
            for dialog in dialogs:
                if not dialog.is_channel:
                    continue

                entity = dialog.entity
                can_post = False
                if getattr(entity, "creator", False):
                    can_post = True
                elif getattr(entity, "admin_rights", None) and getattr(entity.admin_rights, "post_messages", False):
                    can_post = True

                channels.append(
                    Channel(
                        id=dialog.id,
                        title=dialog.name or "Untitled Channel",
                        username=getattr(entity, "username", None),
                        can_post=can_post,
                    )
                )

            # Prioritize channels where user has posting rights
            channels.sort(key=lambda c: (not c.can_post, c.title.lower()))
            return channels[:limit]
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.error(f"Error fetching managed channels: {e}")
            raise

    async def get_channel_messages(
        self, channel_id: int, limit: int = 50, offset_id: int | None = None
    ) -> list[ChannelMessage]:
        """Fetch preview messages from a channel for user selection."""
        results: list[ChannelMessage] = []
        try:
            await self._ensure_connected()
            iter_kwargs: dict[str, Any] = {"limit": limit}
            if offset_id:
                iter_kwargs["offset_id"] = offset_id

            async for message in self.client.iter_messages(channel_id, **iter_kwargs):
                if isinstance(message, types.MessageService) or getattr(message, "action", None) is not None:
                    continue

                media_type: str | None = None
                file_size: int | None = None

                photo = getattr(message, "photo", None)
                if not photo and hasattr(message, "media") and hasattr(message.media, "photo"):
                    photo = message.media.photo

                doc = getattr(message, "document", None)
                if not doc and hasattr(message, "media") and hasattr(message.media, "document"):
                    doc = message.media.document

                if photo and isinstance(photo, types.Photo):
                    media_type = "photo"
                elif doc and isinstance(doc, types.Document):
                    is_video = getattr(doc, "mime_type", "").startswith("video/") or any(
                        isinstance(attr, types.DocumentAttributeVideo)
                        for attr in getattr(doc, "attributes", [])
                    )
                    media_type = "video" if is_video else "document"
                    file_size = getattr(doc, "size", None)
                elif message.message:
                    media_type = "text"

                date_str = message.date.strftime("%Y-%m-%d %H:%M") if message.date else ""
                views = getattr(message, "views", None)

                results.append(
                    ChannelMessage(
                        id=message.id,
                        channel_id=channel_id,
                        text=message.message or "",
                        media_type=media_type,
                        date=date_str,
                        file_size=file_size,
                        views=views,
                    )
                )
            return results
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error fetching channel messages for {channel_id}: {e}")
            raise

    async def get_message_thumbnail(
        self, channel_id: int, message_id: int
    ) -> bytes | None:
        """Fetch small image thumbnail for a message with disk caching."""
        cache_dir = Path("/app/data/thumbnails")
        cache_file = cache_dir / f"{channel_id}_{message_id}.jpg"

        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            if cache_file.exists():
                return cache_file.read_bytes()
        except Exception:
            pass

        try:
            await self._ensure_connected()
            msg = await self.client.get_messages(channel_id, ids=message_id)
            if not msg or not msg.media:
                return None

            # Download thumbnail directly to memory buffer
            thumb_data = await self.client.download_media(msg, file=bytes, thumb=-1)
            if not thumb_data and getattr(msg, "photo", None):
                # Small photo direct download fallback
                thumb_data = await self.client.download_media(msg, file=bytes)

            if thumb_data and isinstance(thumb_data, bytes):
                try:
                    cache_file.write_bytes(thumb_data)
                except Exception:
                    pass
                return thumb_data
            return None
        except Exception as e:
            logger.warning(f"Could not load thumbnail for msg #{message_id} in channel {channel_id}: {e}")
            return None

    async def fetch_channel_videos(
        self, channel_id: int, after_message_id: int | None = None
    ) -> list[VideoMessage]:
        """Fetch all messages (videos, photos, documents, text) sequentially from channel."""
        messages_to_migrate: list[VideoMessage] = []
        min_id = after_message_id or 0
        try:
            async for message in self.client.iter_messages(channel_id, min_id=min_id, reverse=True):
                # Ignore service messages (e.g. pinned message, member join/leave, avatar changes)
                if isinstance(message, types.MessageService) or getattr(message, "action", None) is not None:
                    continue

                # Serialize formatting entities if present
                entities_data: list[dict[str, Any]] = []
                if message.entities:
                    for ent in message.entities:
                        try:
                            entities_data.append(ent.to_dict())
                        except Exception:
                            pass

                caption_text = message.message or ""

                # Check for Photo
                photo = getattr(message, "photo", None)
                if not photo and hasattr(message, "media") and hasattr(message.media, "photo"):
                    photo = message.media.photo

                # Check for Document / Video
                doc = getattr(message, "document", None)
                if not doc and hasattr(message, "media") and hasattr(message.media, "document"):
                    doc = message.media.document

                if photo and isinstance(photo, types.Photo):
                    messages_to_migrate.append(
                        VideoMessage(
                            message_id=message.id,
                            input_document_id=photo.id,
                            access_hash=photo.access_hash,
                            file_reference=photo.file_reference,
                            caption=caption_text,
                            entities=entities_data,
                            source_channel_id=channel_id,
                            media_type="photo",
                        )
                    )
                elif doc and isinstance(doc, types.Document):
                    is_video = False
                    if getattr(doc, "mime_type", "").startswith("video/"):
                        is_video = True
                    elif any(isinstance(attr, types.DocumentAttributeVideo) for attr in getattr(doc, "attributes", [])):
                        is_video = True

                    media_type = "video" if is_video else "document"
                    messages_to_migrate.append(
                        VideoMessage(
                            message_id=message.id,
                            input_document_id=doc.id,
                            access_hash=doc.access_hash,
                            file_reference=doc.file_reference,
                            caption=caption_text,
                            entities=entities_data,
                            source_channel_id=channel_id,
                            media_type=media_type,
                        )
                    )
                elif caption_text.strip():
                    messages_to_migrate.append(
                        VideoMessage(
                            message_id=message.id,
                            input_document_id=0,
                            access_hash=0,
                            file_reference=b"",
                            caption=caption_text,
                            entities=entities_data,
                            source_channel_id=channel_id,
                            media_type="text",
                        )
                    )
                elif message.media:
                    messages_to_migrate.append(
                        VideoMessage(
                            message_id=message.id,
                            input_document_id=0,
                            access_hash=0,
                            file_reference=b"",
                            caption=caption_text,
                            entities=entities_data,
                            source_channel_id=channel_id,
                            media_type="document",
                        )
                    )

            return messages_to_migrate
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e

    async def copy_video_by_reference(
        self, target_channel_id: int, video: VideoMessage
    ) -> int:
        """Post existing message (video, photo, document, text) to target channel.
        
        Zero file bytes are uploaded or downloaded when MTProto reference is accepted;
        Telegram links the existing document/photo.
        Does NOT set forward headers, generating a fresh clean message with original caption.
        If source channel has protected content (noforwards enabled), gracefully falls back
        to resilient temporary download and upload.
        """
        raw_entities = None
        if video.entities:
            raw_entities = []
            for ent_dict in video.entities:
                try:
                    raw_entities.append(types.TypeMessageEntity.from_dict(ent_dict))
                except Exception:
                    pass

        # 1. Plain text messages
        if video.media_type == "text":
            try:
                sent_msg = await self.client.send_message(
                    target_channel_id,
                    message=video.caption or "",
                    formatting_entities=raw_entities,
                )
                return sent_msg.id
            except FloodWaitError as e:
                raise FloodWaitDomainException(seconds=e.seconds) from e
            except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
                raise ChannelAccessDeniedException(str(e)) from e
            except Exception as e:
                logger.error(f"Error sending text message #{video.message_id}: {e}")
                raise

        # 2. Media messages (photo, video, document)
        if video.media_type == "photo" and video.input_document_id:
            media_handle = types.InputPhoto(
                id=video.input_document_id,
                access_hash=video.access_hash,
                file_reference=video.file_reference,
            )
        elif video.input_document_id:
            media_handle = types.InputDocument(
                id=video.input_document_id,
                access_hash=video.access_hash,
                file_reference=video.file_reference,
            )
        else:
            media_handle = None

        try:
            if media_handle is not None:
                sent_msg = await self.client.send_file(
                    target_channel_id,
                    file=media_handle,
                    caption=video.caption or "",
                    formatting_entities=raw_entities,
                )
                return sent_msg.id
            else:
                raise Exception("protected chat fallback needed: no media handle")
        except Exception as e:
            if isinstance(e, FloodWaitError):
                raise FloodWaitDomainException(seconds=e.seconds) from e
            if isinstance(e, (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError)):
                raise ChannelAccessDeniedException(str(e)) from e

            logger.info(
                f"Reference copy failed for message #{video.message_id} ({video.media_type}): {e}. Attempting resilient download/upload fallback..."
            )
            if video.source_channel_id:
                import tempfile
                import os

                source_msg = await self.client.get_messages(video.source_channel_id, ids=video.message_id)
                if source_msg and source_msg.media:
                    suffix = ".mp4" if video.media_type == "video" else (".jpg" if video.media_type == "photo" else "")
                    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                        tmp_path = tmp.name
                    try:
                        downloaded = await self.client.download_media(source_msg, file=tmp_path)
                        if downloaded and os.path.exists(downloaded):
                            sent_msg = await self.client.send_file(
                                target_channel_id,
                                file=downloaded,
                                caption=video.caption or "",
                                formatting_entities=raw_entities,
                            )
                            return sent_msg.id
                    finally:
                        if os.path.exists(tmp_path):
                            try:
                                os.remove(tmp_path)
                            except Exception:
                                pass
            raise

    async def get_dialogs(self, limit: int = 50) -> list[TelegramDialog]:
        """Retrieve conversation dialogs (users, groups, channels) for authenticated account."""
        dialogs_list: list[TelegramDialog] = []
        try:
            await self._ensure_connected()
            dialogs = await self.client.get_dialogs(limit=limit)
            for dialog in dialogs:
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

    async def send_local_media(
        self, channel_id: int, file_path: str, caption: str | None = None
    ) -> ChannelMessage:
        """Upload and post a local media file (video/photo/doc) directly to a channel."""
        try:
            await self._ensure_connected()
            entity = await self.client.get_input_entity(channel_id)
            sent = await self.client.send_file(
                entity,
                file_path,
                caption=caption or "",
                supports_streaming=True,
            )

            media_type = "video"
            if getattr(sent, "photo", None):
                media_type = "photo"
            elif getattr(sent, "video", None):
                media_type = "video"
            elif getattr(sent, "document", None):
                media_type = "document"

            file_size = getattr(sent, "file", None).size if getattr(sent, "file", None) else None

            return ChannelMessage(
                id=sent.id,
                channel_id=channel_id,
                text=sent.message or "",
                media_type=media_type,
                date=sent.date.strftime("%Y-%m-%d %H:%M") if sent.date else "",
                file_size=file_size,
            )
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error uploading local media to channel {channel_id}: {e}")
            raise

    async def send_text_message(
        self, channel_id: int, text: str
    ) -> ChannelMessage:
        """Send a plain text message to a channel."""
        try:
            await self._ensure_connected()
            entity = await self.client.get_input_entity(channel_id)
            sent = await self.client.send_message(entity, text)
            return ChannelMessage(
                id=sent.id,
                channel_id=channel_id,
                text=sent.message or "",
                media_type="text",
                date=sent.date.strftime("%Y-%m-%d %H:%M") if sent.date else "",
            )
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error sending text message to channel {channel_id}: {e}")
            raise

    async def delete_channel_message(
        self, channel_id: int, message_id: int
    ) -> bool:
        """Delete a message from a channel."""
        try:
            await self._ensure_connected()
            entity = await self.client.get_input_entity(channel_id)
            await self.client.delete_messages(entity, [message_id])
            return True
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error deleting message {message_id} from channel {channel_id}: {e}")
            raise

    async def edit_channel_message(
        self, channel_id: int, message_id: int, text: str
    ) -> ChannelMessage:
        """Edit the caption or text of an existing channel message."""
        try:
            await self._ensure_connected()
            entity = await self.client.get_input_entity(channel_id)
            edited = await self.client.edit_message(entity, message_id, text)
            media_type = None
            if getattr(edited, "photo", None):
                media_type = "photo"
            elif getattr(edited, "video", None):
                media_type = "video"
            elif getattr(edited, "document", None):
                media_type = "document"

            return ChannelMessage(
                id=edited.id,
                channel_id=channel_id,
                text=edited.message or "",
                media_type=media_type or "text",
                date=edited.date.strftime("%Y-%m-%d %H:%M") if edited.date else "",
            )
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error editing message {message_id} in channel {channel_id}: {e}")
            raise
