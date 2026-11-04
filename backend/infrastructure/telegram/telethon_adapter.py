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

    def __init__(self, client: TelegramClient, pool: Any = None, tenant_id: str | None = None) -> None:
        self.client = client
        self.pool = pool
        self.tenant_id = str(tenant_id) if tenant_id is not None else None
        self._avatar_cache: dict[int, bytes | None] = {}

    def _get_client(self, account_id: int | None = None) -> TelegramClient:
        if self.pool and account_id is not None:
            c = self.pool.get_client(account_id, tenant_id=self.tenant_id)
            if c:
                return c
            if self.tenant_id is not None:
                raise ChannelAccessDeniedException(
                    f"Account #{account_id} does not belong to tenant '{self.tenant_id}' or is not active."
                )
        if self.pool and self.tenant_id:
            tenant_client = self.pool.get_client(tenant_id=self.tenant_id)
            if tenant_client:
                return tenant_client
        return self.client

    async def _ensure_connected(self, client: TelegramClient | None = None) -> None:
        target = client or self.client
        if not target.is_connected():
            await target.connect()
        if not await target.is_user_authorized():
            raise ChannelAccessDeniedException(
                "La cuenta de Telegram no está autorizada. Por favor vinculá una sesión válida en Configuración o con el script."
            )

    async def _fetch_channels_for_client(
        self, client: TelegramClient, limit: int, account_id: int, account_name: str | None
    ) -> list[Channel]:
        channels: list[Channel] = []
        try:
            await self._ensure_connected(client)
            scan_limit = max(limit * 2, 250)
            dialogs = await client.get_dialogs(limit=scan_limit)
            for dialog in dialogs:
                if not dialog.is_channel and not dialog.is_group:
                    continue

                entity = dialog.entity
                is_broadcast = getattr(entity, "broadcast", False)
                is_megagroup = getattr(entity, "megagroup", False)
                is_creator = getattr(entity, "creator", False)
                admin_rights = getattr(entity, "admin_rights", None)

                can_post = False
                if is_creator:
                    can_post = True
                elif is_broadcast and admin_rights and getattr(admin_rights, "post_messages", False):
                    can_post = True
                elif (is_megagroup or dialog.is_group) and admin_rights:
                    can_post = True

                chat_type = "supergroup" if is_megagroup else ("channel" if is_broadcast else "group")

                channels.append(
                    Channel(
                        id=dialog.id,
                        title=dialog.name or "Untitled Channel",
                        username=getattr(entity, "username", None),
                        can_post=can_post,
                        account_id=account_id,
                        account_name=account_name,
                        type=chat_type,
                    )
                )

            channels.sort(key=lambda c: (not c.can_post, c.title.lower()))
            return channels[:limit]
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.error(f"Error fetching managed channels for account #{account_id}: {e}")
            raise

    async def get_managed_channels(self, limit: int = 100, account_id: int | None = None) -> list[Channel]:
        """Retrieve channels where the authenticated user has posting rights."""
        if self.pool and account_id is None:
            all_channels: list[Channel] = []
            seen_keys = set()
            clients_to_query = (
                self.pool.list_clients(tenant_id=self.tenant_id)
                if self.tenant_id
                else self.pool.list_clients()
            )
            for acc_id, acc_name, cl in clients_to_query:
                try:
                    channels = await self._fetch_channels_for_client(cl, limit, acc_id, acc_name)
                    for ch in channels:
                        key = (ch.id, ch.account_id)
                        if key not in seen_keys:
                            seen_keys.add(key)
                            all_channels.append(ch)
                except Exception as ex:
                    logger.warning(f"Error fetching channels for account {acc_name} (#{acc_id}): {ex}")
            all_channels.sort(key=lambda c: (not c.can_post, c.title.lower()))
            return all_channels

        target_client = self._get_client(account_id)
        acc_name = self.pool.get_account_name(account_id) if self.pool and account_id else "Cuenta Principal"
        effective_acc_id = account_id or 1
        return await self._fetch_channels_for_client(target_client, limit, effective_acc_id, acc_name)

    async def get_channel_messages(
        self, channel_id: int, limit: int = 50, offset_id: int | None = None, account_id: int | None = None
    ) -> list[ChannelMessage]:
        """Fetch preview messages from a channel for user selection."""
        results: list[ChannelMessage] = []
        try:
            client = self._get_client(account_id)
            await self._ensure_connected(client)
            iter_kwargs: dict[str, Any] = {"limit": limit}
            if offset_id:
                iter_kwargs["offset_id"] = offset_id

            async for message in client.iter_messages(channel_id, **iter_kwargs):
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
        self, channel_id: int, message_id: int, repo: Any = None, account_id: int | None = None
    ) -> bytes | None:
        """Fetch small image thumbnail for a message with disk caching and provenance fallback."""
        cache_dir = Path("/app/data/thumbnails")
        cache_file = cache_dir / f"{channel_id}_{message_id}.jpg"

        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            if cache_file.exists():
                return cache_file.read_bytes()
        except Exception:
            pass

        try:
            client = self._get_client(account_id)
            await self._ensure_connected(client)
            try:
                entity = await client.get_input_entity(channel_id)
            except Exception:
                entity = await client.get_entity(channel_id)
            msg = await client.get_messages(entity, ids=message_id)
            if msg and msg.media:
                # Download thumbnail directly to memory buffer
                thumb_data = await client.download_media(msg, file=bytes, thumb=-1)
                if not thumb_data:
                    thumb_data = await client.download_media(msg, file=bytes, thumb=0)
                if not thumb_data and getattr(msg, "photo", None):
                    thumb_data = await client.download_media(msg, file=bytes)

                if thumb_data and isinstance(thumb_data, bytes):
                    try:
                        cache_file.write_bytes(thumb_data)
                    except Exception:
                        pass
                    return thumb_data

            # Fallback for cloned/migrated messages without embedded thumbnail in target:
            # Query source channel & message provenance from DB
            if repo is not None and hasattr(repo, "get_source_item_for_target"):
                source_info = await repo.get_source_item_for_target(channel_id, message_id)
                if source_info:
                    src_chan_id, src_msg_id = source_info
                    src_cache_file = cache_dir / f"{src_chan_id}_{src_msg_id}.jpg"
                    if src_cache_file.exists():
                        try:
                            data = src_cache_file.read_bytes()
                            if data:
                                cache_file.write_bytes(data)
                                return data
                        except Exception:
                            pass

                    try:
                        try:
                            src_entity = await client.get_input_entity(src_chan_id)
                        except Exception:
                            src_entity = await client.get_entity(src_chan_id)
                        src_msg = await client.get_messages(src_entity, ids=src_msg_id)
                        if src_msg and src_msg.media:
                            src_thumb = await client.download_media(src_msg, file=bytes, thumb=-1)
                            if not src_thumb:
                                src_thumb = await client.download_media(src_msg, file=bytes, thumb=0)
                            if not src_thumb and getattr(src_msg, "photo", None):
                                src_thumb = await client.download_media(src_msg, file=bytes)
                            if src_thumb and isinstance(src_thumb, bytes):
                                try:
                                    cache_file.write_bytes(src_thumb)
                                    src_cache_file.write_bytes(src_thumb)
                                except Exception:
                                    pass
                                return src_thumb
                    except Exception as src_err:
                        logger.debug(f"Could not load thumbnail from source message #{src_msg_id} in {src_chan_id}: {src_err}")

            return None
        except Exception as e:
            logger.warning(f"Could not load thumbnail for msg #{message_id} in channel {channel_id}: {e}")
            return None

    async def get_message_media_for_streaming(
        self, channel_id: int, message_id: int, repo: Any = None, account_id: int | None = None
    ) -> tuple[TelegramClient, Any, int, str] | None:
        """Fetch client, media object, file size and mime_type for video streaming with provenance fallback."""
        try:
            client = self._get_client(account_id)
            await self._ensure_connected(client)
            try:
                entity = await client.get_input_entity(channel_id)
            except Exception:
                entity = await client.get_entity(channel_id)

            msg = await client.get_messages(entity, ids=message_id)
            media = None
            if msg and msg.media:
                media = getattr(msg, "video", None) or getattr(msg, "document", None) or msg.media

            if not media and repo is not None and hasattr(repo, "get_source_item_for_target"):
                source_info = await repo.get_source_item_for_target(channel_id, message_id)
                if source_info:
                    src_chan_id, src_msg_id = source_info
                    try:
                        src_entity = await client.get_input_entity(src_chan_id)
                    except Exception:
                        src_entity = await client.get_entity(src_chan_id)
                    src_msg = await client.get_messages(src_entity, ids=src_msg_id)
                    if src_msg and src_msg.media:
                        media = getattr(src_msg, "video", None) or getattr(src_msg, "document", None) or src_msg.media

            if not media:
                return None

            file_size = getattr(media, "size", 0)
            mime_type = getattr(media, "mime_type", "video/mp4") or "video/mp4"
            return client, media, file_size, mime_type
        except Exception as e:
            logger.warning(f"Error fetching media for streaming in chat {channel_id} msg {message_id}: {e}")
            return None

    @staticmethod
    async def stream_media_range(
        client: TelegramClient, media: Any, start: int, length: int, chunk_size: int = 256 * 1024
    ):
        """Asynchronously stream chunks of bytes for a media object starting at offset."""
        bytes_sent = 0
        async for chunk in client.iter_download(media, offset=start, request_size=chunk_size):
            remaining = length - bytes_sent
            if remaining <= 0:
                break
            if len(chunk) > remaining:
                yield chunk[:remaining]
                bytes_sent += remaining
                break
            yield chunk
            bytes_sent += len(chunk)

    async def fetch_channel_videos(
        self, channel_id: int, after_message_id: int | None = None, account_id: int | None = None
    ) -> list[VideoMessage]:
        """Fetch all messages (videos, photos, documents, text) sequentially from channel."""
        messages_to_migrate: list[VideoMessage] = []
        min_id = after_message_id or 0
        try:
            client = self._get_client(account_id)
            await self._ensure_connected(client)
            async for message in client.iter_messages(channel_id, min_id=min_id, reverse=True):
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
                    p_w = 0
                    p_h = 0
                    p_size = 0
                    if getattr(photo, "sizes", None):
                        largest = photo.sizes[-1]
                        p_w = getattr(largest, "w", 0) or 0
                        p_h = getattr(largest, "h", 0) or 0
                        p_size = getattr(largest, "size", 0) or 0
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
                            width=int(p_w),
                            height=int(p_h),
                            file_size=int(p_size),
                        )
                    )
                elif doc and isinstance(doc, types.Document):
                    is_video = False
                    if getattr(doc, "mime_type", "").startswith("video/"):
                        is_video = True
                    elif any(isinstance(attr, types.DocumentAttributeVideo) for attr in getattr(doc, "attributes", [])):
                        is_video = True

                    duration = 0
                    width = 0
                    height = 0
                    for attr in getattr(doc, "attributes", []):
                        if isinstance(attr, types.DocumentAttributeVideo):
                            duration = getattr(attr, "duration", 0) or 0
                            width = getattr(attr, "w", 0) or 0
                            height = getattr(attr, "h", 0) or 0
                            break
                    file_size = getattr(doc, "size", 0) or 0

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
                            duration=int(duration),
                            width=int(width),
                            height=int(height),
                            file_size=int(file_size),
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
        self, target_channel_id: int, video: VideoMessage, account_id: int | None = None
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

        client = self._get_client(account_id)
        await self._ensure_connected(client)

        # 1. Plain text messages
        if video.media_type == "text":
            try:
                sent_msg = await client.send_message(
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
                sent_msg = await client.send_file(
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

                source_msg = await client.get_messages(video.source_channel_id, ids=video.message_id)
                if source_msg and source_msg.media:
                    suffix = ".mp4" if video.media_type == "video" else (".jpg" if video.media_type == "photo" else "")
                    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                        tmp_path = tmp.name
                    try:
                        downloaded = await client.download_media(source_msg, file=tmp_path)
                        if downloaded and os.path.exists(downloaded):
                            sent_msg = await client.send_file(
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

    async def copy_media_cross_account(
        self,
        source_channel_id: int,
        target_channel_id: int,
        video: VideoMessage,
        source_account_id: int,
        target_account_id: int,
    ) -> int:
        """Bridge copy media between different accounts using temporary streaming buffer."""
        src_client = self._get_client(source_account_id)
        tgt_client = self._get_client(target_account_id)
        await self._ensure_connected(src_client)
        await self._ensure_connected(tgt_client)

        raw_entities = None
        if getattr(video, "entities", None):
            raw_entities = []
            for ent_dict in video.entities:
                try:
                    if isinstance(ent_dict, dict):
                        raw_entities.append(types.TypeMessageEntity.from_dict(ent_dict))
                    else:
                        raw_entities.append(ent_dict)
                except Exception:
                    pass

        caption = video.caption or ""

        # 1. Plain text messages
        if video.media_type == "text" or (not video.input_document_id and video.media_type != "photo"):
            try:
                sent_msg = await tgt_client.send_message(
                    target_channel_id,
                    message=caption,
                    formatting_entities=raw_entities,
                )
                return sent_msg.id
            except FloodWaitError as e:
                raise FloodWaitDomainException(seconds=e.seconds) from e
            except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
                raise ChannelAccessDeniedException(str(e)) from e

        # 2. Media messages (video, photo, document)
        import tempfile
        import os

        suffix = ".mp4" if video.media_type == "video" else (".jpg" if video.media_type == "photo" else "")
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp_path = tmp.name

        try:
            src_msg = await src_client.get_messages(source_channel_id, ids=video.message_id)
            if not src_msg or not src_msg.media:
                sent_msg = await tgt_client.send_message(
                    target_channel_id,
                    message=caption,
                    formatting_entities=raw_entities,
                )
                return sent_msg.id

            downloaded = await src_client.download_media(src_msg, file=tmp_path)
            if not downloaded or not os.path.exists(downloaded):
                raise RuntimeError(f"Failed to download media for message #{video.message_id}")

            sent_msg = await tgt_client.send_file(
                target_channel_id,
                file=downloaded,
                caption=caption,
                formatting_entities=raw_entities,
            )
            return sent_msg.id
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    async def get_dialogs(self, limit: int = 50, account_id: int | None = None) -> list[TelegramDialog]:
        """Retrieve conversation dialogs (users, groups, channels) for authenticated account."""
        dialogs_list: list[TelegramDialog] = []
        try:
            client = self._get_client(account_id)
            await self._ensure_connected(client)
            dialogs = await client.get_dialogs(limit=limit)
            for dialog in dialogs:
                if dialog.is_user:
                    chat_type = "user"
                elif dialog.is_group:
                    chat_type = "group"
                elif dialog.is_channel:
                    chat_type = "channel"
                else:
                    chat_type = "user"

                can_post = True
                if dialog.is_channel:
                    entity = dialog.entity
                    is_broadcast = getattr(entity, "broadcast", False)
                    is_creator = getattr(entity, "creator", False)
                    admin_rights = getattr(entity, "admin_rights", None)
                    default_banned = getattr(entity, "default_banned_rights", None)

                    if is_broadcast:
                        can_post = bool(is_creator or (admin_rights and getattr(admin_rights, "post_messages", False)))
                    else:
                        if not is_creator and not admin_rights:
                            if default_banned and getattr(default_banned, "send_messages", False):
                                can_post = False
                elif dialog.is_group:
                    entity = dialog.entity
                    default_banned = getattr(entity, "default_banned_rights", None)
                    if default_banned and getattr(default_banned, "send_messages", False):
                        can_post = False

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

                raw_d = getattr(dialog, "dialog", None)
                read_inbox_max_id = getattr(raw_d, "read_inbox_max_id", 0) or 0
                read_outbox_max_id = getattr(raw_d, "read_outbox_max_id", 0) or 0

                dialogs_list.append(
                    TelegramDialog(
                        id=dialog.id,
                        title=dialog.name or "Sin título",
                        type=chat_type,
                        unread_count=dialog.unread_count or 0,
                        last_message=last_msg_text,
                        last_message_date=last_msg_date,
                        avatar_color=avatar_color,
                        can_post=can_post,
                        read_inbox_max_id=read_inbox_max_id,
                        read_outbox_max_id=read_outbox_max_id,
                        username=getattr(dialog.entity, "username", None),
                        account_id=account_id,
                    )
                )
            return dialogs_list
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.error(f"Error fetching dialogs: {e}")
            raise

    async def mark_dialog_as_read(
        self, chat_id: int, max_id: int | None = None, account_id: int | None = None
    ) -> bool:
        """Acknowledge reading messages up to max_id using MTProto send_read_acknowledge."""
        try:
            client = self._get_client(account_id)
            await self._ensure_connected(client)
            try:
                entity = await client.get_input_entity(chat_id)
            except Exception:
                entity = await client.get_entity(chat_id)
            await client.send_read_acknowledge(entity, max_id=max_id)
            return True
        except Exception as e:
            logger.warning(f"Error marking dialog {chat_id} as read: {e}")
            return False

    async def get_chat_messages(
        self, chat_id: int, limit: int = 50, account_id: int | None = None
    ) -> list[ChatMessage]:
        """Fetch recent message history from a specific chat in chronological order."""
        messages_list: list[ChatMessage] = []
        try:
            client = self._get_client(account_id)
            await self._ensure_connected(client)

            read_inbox_max_id = 0
            read_outbox_max_id = 0
            try:
                async for d in client.iter_dialogs(limit=50):
                    if d.id == chat_id:
                        raw_d = getattr(d, "dialog", None)
                        read_inbox_max_id = getattr(raw_d, "read_inbox_max_id", 0) or 0
                        read_outbox_max_id = getattr(raw_d, "read_outbox_max_id", 0) or 0
                        break
            except Exception:
                pass

            async for msg in client.iter_messages(chat_id, limit=limit):
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
                is_outgoing = bool(msg.out)
                is_read = (msg.id <= read_outbox_max_id) if is_outgoing else (msg.id <= read_inbox_max_id)

                messages_list.append(
                    ChatMessage(
                        id=msg.id,
                        chat_id=chat_id,
                        sender_id=msg.sender_id or 0,
                        sender_name=sender_name,
                        text=msg.message or (f"[{media_type.capitalize()}]" if media_type else ""),
                        date=date_str,
                        is_outgoing=is_outgoing,
                        media_type=media_type,
                        is_read=is_read,
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
        self, channel_id: int, message_id: int, account_id: int | None = None
    ) -> bool:
        """Delete a message from a channel."""
        client = self._get_client(account_id)
        try:
            await self._ensure_connected(client)
            entity = await client.get_input_entity(channel_id)
            await client.delete_messages(entity, [message_id])
            return True
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error deleting message {message_id} from channel {channel_id}: {e}")
            raise

    async def delete_channel_messages(
        self, channel_id: int, message_ids: list[int], account_id: int | None = None
    ) -> bool:
        """Delete multiple messages from a channel in a single MTProto call."""
        if not message_ids:
            return True
        client = self._get_client(account_id)
        try:
            await self._ensure_connected(client)
            entity = await client.get_input_entity(channel_id)
            await client.delete_messages(entity, message_ids)
            return True
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error deleting messages from channel {channel_id}: {e}")
            raise

    async def edit_channel_message(
        self, channel_id: int, message_id: int, text: str, account_id: int | None = None
    ) -> ChannelMessage:
        """Edit the caption or text of an existing channel message."""
        client = self._get_client(account_id)
        try:
            await self._ensure_connected(client)
            entity = await client.get_input_entity(channel_id)
            edited = await client.edit_message(entity, message_id, text)
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

    async def get_messages_by_ids(
        self, channel_id: int, message_ids: list[int], account_id: int | None = None
    ) -> list[ChannelMessage]:
        """Fetch specific messages from a channel by their IDs."""
        client = self._get_client(account_id)
        try:
            await self._ensure_connected(client)
            entity = await client.get_input_entity(channel_id)
            msgs = await client.get_messages(entity, ids=message_ids)
            result = []
            for m in msgs:
                if not m:
                    continue
                media_type = "text"
                if getattr(m, "photo", None):
                    media_type = "photo"
                elif getattr(m, "video", None):
                    media_type = "video"
                elif getattr(m, "document", None):
                    media_type = "document"
                result.append(
                    ChannelMessage(
                        id=m.id,
                        channel_id=channel_id,
                        text=m.message or "",
                        media_type=media_type,
                        date=m.date.strftime("%Y-%m-%d %H:%M") if m.date else "",
                    )
                )
            return result
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.error(f"Error fetching messages by IDs for channel {channel_id}: {e}")
            raise

    async def send_media_album(
        self,
        target_channel_id: int,
        source_channel_id: int,
        message_ids: list[int],
        caption: str,
        account_id: int | None = None,
        schedule_date: Any = None,
    ) -> list[int]:
        """Post multiple media items from source channel as a grouped Telegram album (MediaGroup).

        Enforces 2 <= len(message_ids) <= 10. Links media by reference without download if possible;
        otherwise falls back to download/upload.
        """
        if not message_ids or len(message_ids) < 2:
            raise ValueError("Telegram albums require at least 2 media items.")
        if len(message_ids) > 10:
            raise ValueError("Telegram albums allow a maximum of 10 media items.")

        client = self._get_client(account_id)
        await self._ensure_connected(client)

        try:
            # Fetch source messages
            messages = await client.get_messages(source_channel_id, ids=message_ids)
            # Retain non-null messages with media
            media_msgs = [m for m in messages if m and getattr(m, "media", None)]
            if len(media_msgs) < 2:
                raise ValueError(
                    f"Only {len(media_msgs)} valid media items found among the requested IDs. An album requires at least 2."
                )

            try:
                sent_msgs = await client.send_file(
                    target_channel_id,
                    file=media_msgs,
                    caption=caption or "",
                    schedule=schedule_date,
                )
                if isinstance(sent_msgs, list):
                    return [m.id for m in sent_msgs]
                return [sent_msgs.id]
            except (FloodWaitError, ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError):
                raise
            except Exception as ref_err:
                logger.info(
                    f"Reference album send failed ({ref_err}), attempting resilient download/upload fallback..."
                )
                import tempfile
                import os

                downloaded_files = []
                try:
                    for m in media_msgs:
                        ext = ".mp4" if getattr(m, "video", None) else (".jpg" if getattr(m, "photo", None) else "")
                        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                            tmp_path = tmp.name
                        dl = await client.download_media(m, file=tmp_path)
                        downloaded_files.append(dl if dl and os.path.exists(dl) else tmp_path)

                    sent_msgs = await client.send_file(
                        target_channel_id,
                        file=downloaded_files,
                        caption=caption or "",
                        schedule=schedule_date,
                    )
                    if isinstance(sent_msgs, list):
                        return [m.id for m in sent_msgs]
                    return [sent_msgs.id]
                finally:
                    for f in downloaded_files:
                        if os.path.exists(f):
                            try:
                                os.remove(f)
                            except Exception:
                                pass
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except (ChatAdminRequiredError, ChannelPrivateError, UserBannedInChannelError) as e:
            raise ChannelAccessDeniedException(str(e)) from e
        except Exception as e:
            logger.error(f"Error publishing album to channel {target_channel_id}: {e}")
            raise

    async def get_entity_avatar(
        self, entity_id: int, account_id: int | None = None
    ) -> bytes | None:
        """Retrieve small profile photo / avatar thumbnail bytes for a user, group, or channel."""
        if entity_id in self._avatar_cache:
            return self._avatar_cache[entity_id]

        client = self._get_client(account_id)
        try:
            await self._ensure_connected(client)
            entity = await client.get_entity(entity_id)
            if not getattr(entity, "photo", None):
                self._avatar_cache[entity_id] = None
                return None

            photo_bytes = await client.download_profile_photo(
                entity, file=bytes, download_big=False
            )
            self._avatar_cache[entity_id] = photo_bytes
            return photo_bytes
        except Exception as e:
            logger.debug(f"Could not download avatar for entity {entity_id}: {e}")
            return None

    async def kick_chat_member(
        self, channel_id: int, user_id: int, account_id: int | None = None
    ) -> bool:
        """Kick/remove a member from a channel or supergroup."""
        client = self._get_client(account_id)
        await self._ensure_connected(client)
        try:
            from telethon.tl.functions.channels import EditBannedRequest
            from telethon.tl.types import ChatBannedRights

            # Temporarily ban to kick
            await client(
                EditBannedRequest(
                    channel=channel_id,
                    participant=user_id,
                    banned_rights=ChatBannedRights(until_date=None, view_messages=True),
                )
            )
            # Lift ban to leave them free to re-subscribe
            await client(
                EditBannedRequest(
                    channel=channel_id,
                    participant=user_id,
                    banned_rights=ChatBannedRights(until_date=None, view_messages=False),
                )
            )
            return True
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.error(f"Error kicking user {user_id} from channel {channel_id}: {e}")
            return False

    async def create_channel_invite_link(
        self,
        channel_id: int,
        expire_date: int | None = None,
        member_limit: int = 1,
        request_needed: bool = False,
        title: str | None = None,
        account_id: int | None = None,
    ) -> str:
        """Create a single-use or approval-required invite link for a channel."""
        client = self._get_client(account_id)
        await self._ensure_connected(client)
        try:
            from telethon.tl.functions.messages import ExportChatInviteRequest
            kwargs: dict[str, Any] = {"peer": channel_id}
            if request_needed:
                kwargs["request_needed"] = True
                if title:
                    kwargs["title"] = title
            else:
                kwargs["usage_limit"] = member_limit
                if expire_date:
                    kwargs["expire_date"] = expire_date
                if title:
                    kwargs["title"] = title

            res = await client(ExportChatInviteRequest(**kwargs))
            return getattr(res, "link", "")
        except FloodWaitError as e:
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.error(f"Error creating invite link for channel {channel_id}: {e}")
            raise

    async def send_direct_message(
        self, recipient: str | int, text: str, account_id: int | None = None
    ) -> bool:
        """Send a direct private message to a Telegram user by username or user_id."""
        client = self._get_client(account_id)
        await self._ensure_connected(client)
        try:
            target = recipient.strip() if isinstance(recipient, str) else recipient
            await client.send_message(target, text)
            logger.info(f"Direct message sent successfully to {target} via account {account_id or 1}.")
            return True
        except FloodWaitError as e:
            logger.warning(f"Flood wait when sending DM to {recipient}: {e.seconds}s")
            raise FloodWaitDomainException(seconds=e.seconds) from e
        except Exception as e:
            logger.warning(f"Failed to send direct message to {recipient}: {e}")
            return False

    async def get_join_requests(
        self, channel_id: int, account_id: int | None = None
    ) -> list[dict]:
        """Fetch pending join requests for a channel via MTProto."""
        client = self._get_client(account_id)
        await self._ensure_connected(client)
        try:
            from telethon.tl.functions.messages import GetChatInviteImportersRequest
            from telethon.tl.types import InputUserEmpty

            res = await client(
                GetChatInviteImportersRequest(
                    peer=channel_id,
                    offset_date=None,
                    offset_user=InputUserEmpty(),
                    limit=50,
                    requested=True,
                )
            )

            user_map = {u.id: u for u in getattr(res, "users", [])}
            requests: list[dict] = []
            for imp in getattr(res, "importers", []):
                u = user_map.get(imp.user_id)
                requests.append({
                    "channel_id": channel_id,
                    "user_id": imp.user_id,
                    "date": imp.date.isoformat() if imp.date else None,
                    "about": getattr(imp, "about", None),
                    "first_name": getattr(u, "first_name", "") if u else "",
                    "last_name": getattr(u, "last_name", "") if u else "",
                    "username": getattr(u, "username", None) if u else None,
                })
            return requests
        except Exception as e:
            logger.warning(f"Error fetching join requests for channel {channel_id}: {e}")
            return []

    async def hide_join_request(
        self, channel_id: int, user_id: int, approved: bool = True, account_id: int | None = None
    ) -> bool:
        """Approve or reject a pending join request via MTProto."""
        client = self._get_client(account_id)
        await self._ensure_connected(client)
        try:
            from telethon.tl.functions.messages import HideChatJoinRequestRequest

            await client(
                HideChatJoinRequestRequest(
                    peer=channel_id,
                    user_id=user_id,
                    approved=approved,
                )
            )
            logger.info(
                f"Join request for user {user_id} in channel {channel_id} successfully {'approved' if approved else 'rejected'}."
            )
            return True
        except Exception as e:
            err_msg = str(e).lower()
            if "already a participant" in err_msg or "user_already_participant" in err_msg:
                logger.info(
                    f"User {user_id} is already a participant of channel {channel_id}. Treating as approved."
                )
                return True
            logger.error(
                f"Error {'approving' if approved else 'rejecting'} join request for user {user_id} in channel {channel_id}: {e}"
            )
            return False

    async def invite_user_to_channel(
        self, channel_id: int, user_id_or_username: str | int, account_id: int | None = None
    ) -> bool:
        """Directly invite/add a user to a channel or supergroup via MTProto."""
        client = self._get_client(account_id)
        await self._ensure_connected(client)
        try:
            from telethon.tl.functions.channels import InviteToChannelRequest
            target = user_id_or_username.strip() if isinstance(user_id_or_username, str) else user_id_or_username
            user_entity = await client.get_input_entity(target)
            channel_entity = await client.get_input_entity(channel_id)
            await client(InviteToChannelRequest(channel=channel_entity, users=[user_entity]))
            logger.info(f"Successfully invited user {target} directly to channel {channel_id}.")
            return True
        except Exception as e:
            logger.warning(f"Could not directly invite {user_id_or_username} to channel {channel_id}: {e}")
            raise
