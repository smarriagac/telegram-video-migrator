from __future__ import annotations

from datetime import datetime
import logging
import os
from pathlib import Path
import tempfile
from typing import Any
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.application.use_cases.get_dialogs_use_case import GetDialogsUseCase
from backend.application.use_cases.get_chat_messages_use_case import GetChatMessagesUseCase
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.presentation.dependencies import (
    get_dialogs_use_case,
    get_chat_messages_use_case,
    get_telegram_gateway,
    get_job_repository,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dialogs", tags=["Dialogs"])


class DialogResponse(BaseModel):
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


class ChatMessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    sender_name: str
    text: str
    date: str
    is_outgoing: bool
    media_type: str | None = None
    is_read: bool = False
    buttons: list[list[dict]] | None = None


class SendChatMessageRequest(BaseModel):
    text: str


class EditChatMessageRequest(BaseModel):
    text: str
    account_id: int | None = None


class MarkDialogReadRequest(BaseModel):
    max_id: int | None = None


class ForwardMessagesRequest(BaseModel):
    message_ids: list[int]
    target_chat_ids: list[int]
    account_id: int | None = None


class CheckInviteRequest(BaseModel):
    invite_url: str
    account_id: int | None = None


class JoinInviteRequest(BaseModel):
    invite_url: str
    account_id: int | None = None


class ResolveMessageLinkRequest(BaseModel):
    url: str
    account_id: int | None = None


class OpenBotRequest(BaseModel):
    bot_username: str
    start_param: str | None = None
    account_id: int | None = None


# Demo Fallbacks for development / unauthorized MTProto environments
DEMO_DIALOGS = [
    DialogResponse(
        id=101,
        title="Carlos Méndez",
        type="user",
        unread_count=2,
        last_message="Che, ¿pudiste migrar los videos del canal?",
        last_message_date="13:42",
        avatar_color="bg-cyan-500",
        read_inbox_max_id=2,
        read_outbox_max_id=2,
    ),
    DialogResponse(
        id=102,
        title="Comunidad Devs Telegram",
        type="group",
        unread_count=0,
        last_message="Nuevo release de Telethon v1.36 listo",
        last_message_date="12:15",
        avatar_color="bg-emerald-500",
    ),
    DialogResponse(
        id=103,
        title="Canal de Contenidos y Videos",
        type="channel",
        unread_count=0,
        last_message="Video publicado: Resumen de arquitectura",
        last_message_date="Ayer",
        avatar_color="bg-purple-500",
    ),
    DialogResponse(
        id=104,
        title="🔥La aldea del cacique🔥",
        type="channel",
        unread_count=5,
        last_message="Nuevo video HD disponible para clonar",
        last_message_date="11:30",
        avatar_color="bg-amber-500",
    ),
    DialogResponse(
        id=105,
        title="Prueba 2.0 - reenvio",
        type="channel",
        unread_count=0,
        last_message="Canal destino sincronizado correctamente",
        last_message_date="10:45",
        avatar_color="bg-cyan-600",
    ),
    DialogResponse(
        id=106,
        title="Canal VIP Multimedia",
        type="channel",
        unread_count=12,
        last_message="Actualización de galería de contenidos",
        last_message_date="09:15",
        avatar_color="bg-rose-500",
    ),
    DialogResponse(
        id=107,
        title="Equipo de Infraestructura",
        type="group",
        unread_count=1,
        last_message="El cluster PostgreSQL 18 está corriendo óptimo",
        last_message_date="08:50",
        avatar_color="bg-blue-600",
    ),
    DialogResponse(
        id=108,
        title="Laura Gómez (QA)",
        type="user",
        unread_count=0,
        last_message="Probando las subidas de archivos locales",
        last_message_date="08:20",
        avatar_color="bg-indigo-500",
    ),
    DialogResponse(
        id=109,
        title="Canal de Anuncios Oficiales",
        type="channel",
        unread_count=0,
        last_message="Mantenimiento de servidores completado",
        last_message_date="29 Oct",
        avatar_color="bg-teal-500",
        can_post=False,
    ),
    DialogResponse(
        id=110,
        title="Soporte Técnico Telegram",
        type="group",
        unread_count=0,
        last_message="Tokens y credenciales cifradas con Fernet",
        last_message_date="28 Oct",
        avatar_color="bg-violet-600",
    ),
    DialogResponse(
        id=111,
        title="Martín Palermo",
        type="user",
        unread_count=0,
        last_message="Dale, reviso los cambios de la arquitectura",
        last_message_date="28 Oct",
        avatar_color="bg-pink-500",
    ),
    DialogResponse(
        id=112,
        title="Canal de Backups y Dumps",
        type="channel",
        unread_count=0,
        last_message="Backup semanal generado sin fallos",
        last_message_date="27 Oct",
        avatar_color="bg-emerald-600",
    ),
]

DEMO_MESSAGES: dict[int, list[ChatMessageResponse]] = {
    101: [
        ChatMessageResponse(
            id=1,
            chat_id=101,
            sender_id=101,
            sender_name="Carlos Méndez",
            text="Hola! Cómo va el desarrollo del migrador?",
            date="13:35",
            is_outgoing=False,
            is_read=True,
        ),
        ChatMessageResponse(
            id=2,
            chat_id=101,
            sender_id=999,
            sender_name="Yo",
            text="Impecable, ya soporta clonación limpia por referencia sin descargar nada.",
            date="13:40",
            is_outgoing=True,
            is_read=True,
        ),
        ChatMessageResponse(
            id=3,
            chat_id=101,
            sender_id=101,
            sender_name="Carlos Méndez",
            text="Che, ¿pudiste migrar los videos del canal?",
            date="13:42",
            is_outgoing=False,
            is_read=False,
        ),
        ChatMessageResponse(
            id=4,
            chat_id=101,
            sender_id=101,
            sender_name="Carlos Méndez",
            text="Avisame cualquier duda con las claves de acceso",
            date="13:43",
            is_outgoing=False,
            is_read=False,
        ),
    ]
}


@router.get("", response_model=list[DialogResponse])
async def list_dialogs(
    limit: int = Query(100, ge=1, le=500),
    account_id: int | None = Query(None),
    use_case: GetDialogsUseCase = Depends(get_dialogs_use_case),
) -> list[DialogResponse]:
    """Retrieve Telegram dialogs with unread counts and last message."""
    try:
        dialogs = await use_case.execute(limit=limit, account_id=account_id)
        return [
            DialogResponse(
                id=d.id,
                title=d.title,
                type=d.type,
                unread_count=d.unread_count,
                last_message=d.last_message,
                last_message_date=d.last_message_date,
                avatar_color=d.avatar_color,
                can_post=getattr(d, "can_post", True),
                read_inbox_max_id=getattr(d, "read_inbox_max_id", 0),
                read_outbox_max_id=getattr(d, "read_outbox_max_id", 0),
                username=getattr(d, "username", None),
                account_id=getattr(d, "account_id", None),
                participants_count=getattr(d, "participants_count", None),
                online_count=getattr(d, "online_count", None),
                is_creator=getattr(d, "is_creator", False),
                is_admin=getattr(d, "is_admin", False),
                is_online=getattr(d, "is_online", None),
                status_text=getattr(d, "status_text", None),
            )
            for d in dialogs
        ]
    except Exception as e:
        logger.warning(f"Error fetching dialogs: {e}. Returning demo dialogs.")
        return DEMO_DIALOGS[:limit]


@router.get("/{chat_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    chat_id: int,
    limit: int = Query(50, ge=1, le=500),
    offset_id: int | None = Query(None),
    query: str | None = Query(None),
    account_id: int | None = Query(None),
    use_case: GetChatMessagesUseCase = Depends(get_chat_messages_use_case),
) -> list[ChatMessageResponse]:
    """Retrieve message history for a specific Telegram chat, optionally filtered by search query or paginated by offset_id."""
    try:
        messages = await use_case.execute(
            chat_id=chat_id,
            limit=limit,
            offset_id=offset_id,
            account_id=account_id,
            search_query=query,
        )
        return [
            ChatMessageResponse(
                id=m.id,
                chat_id=m.chat_id,
                sender_id=m.sender_id,
                sender_name=m.sender_name,
                text=m.text,
                date=m.date,
                is_outgoing=m.is_outgoing,
                media_type=m.media_type,
                is_read=getattr(m, "is_read", False),
                buttons=getattr(m, "buttons", None),
            )
            for m in messages
        ]
    except Exception as e:
        logger.warning(f"Error fetching messages for chat {chat_id}: {e}")
        return DEMO_MESSAGES.get(chat_id, [])


@router.get("/{chat_id}/hashtags")
async def get_chat_hashtags_endpoint(
    chat_id: int,
    limit: int = Query(500, ge=0, le=50000),
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Extract all unique #hashtags from chat history and generate a structured directory."""
    try:
        result = await gateway.extract_chat_hashtags(
            chat_id=chat_id,
            limit=limit,
            account_id=account_id,
        )
        return result
    except Exception as e:
        logger.error(f"Error extracting hashtags for chat {chat_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al analizar hashtags: {e}",
        )


@router.post("/{chat_id}/read")
async def mark_dialog_read_endpoint(
    chat_id: int,
    payload: MarkDialogReadRequest | None = None,
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Mark dialog messages up to max_id as read in Telegram MTProto."""
    max_id = payload.max_id if payload else None
    success = await gateway.mark_dialog_as_read(
        chat_id=chat_id, max_id=max_id, account_id=account_id
    )
    for d in DEMO_DIALOGS:
        if d.id == chat_id:
            d.unread_count = 0
            if max_id:
                d.read_inbox_max_id = max(d.read_inbox_max_id, max_id)
    if chat_id in DEMO_MESSAGES:
        for m in DEMO_MESSAGES[chat_id]:
            if not m.is_outgoing and (max_id is None or m.id <= max_id):
                m.is_read = True

    return {"success": success, "chat_id": chat_id, "max_id": max_id}


@router.get("/{chat_id}/avatar")
async def get_dialog_avatar_endpoint(
    chat_id: int,
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> Response:
    """Retrieve profile photo thumbnail for a chat/user/channel."""
    photo_bytes = await gateway.get_entity_avatar(chat_id, account_id=account_id)
    if not photo_bytes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return Response(
        content=photo_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


DEMO_THUMBNAIL_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200" fill="none">
  <rect width="360" height="200" fill="#14161F"/>
  <rect x="1" y="1" width="358" height="198" rx="8" stroke="#ffffff" stroke-opacity="0.08"/>
  <circle cx="180" cy="90" r="26" fill="#06B6D4" fill-opacity="0.2" stroke="#06B6D4" stroke-width="2"/>
  <polygon points="175,80 191,90 175,100" fill="#06B6D4"/>
  <text x="180" y="136" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#94A3B8" text-anchor="middle">Previsualizacion de Video</text>
  <text x="180" y="152" font-family="monospace" font-size="9" fill="#06B6D4" text-anchor="middle">MTProto Stream HD</text>
</svg>""".encode("utf-8")


@router.get("/{chat_id}/messages/{message_id}/thumbnail")
async def get_dialog_message_thumbnail_endpoint(
    chat_id: int,
    message_id: int,
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> Response:
    """Retrieve message media thumbnail with browser caching and provenance resolution."""
    try:
        thumb = await gateway.get_message_thumbnail(
            channel_id=chat_id,
            message_id=message_id,
            repo=repo,
            account_id=account_id,
        )
        if thumb:
            return Response(
                content=thumb,
                media_type="image/jpeg",
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except Exception as e:
        logger.debug(f"Could not load MTProto thumbnail for msg {message_id} in chat {chat_id}: {e}")

    return Response(
        content=DEMO_THUMBNAIL_SVG,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/{chat_id}/messages/{message_id}/video")
async def stream_dialog_message_video_endpoint(
    chat_id: int,
    message_id: int,
    request: Request,
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> Response:
    """Stream video media directly from Telegram MTProto with HTTP Range support for inline & modal player."""
    try:
        media_info = await gateway.get_message_media_for_streaming(
            channel_id=chat_id, message_id=message_id, repo=repo, account_id=account_id
        )
        if not media_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video no encontrado en este mensaje.",
            )

        client, media, file_size, mime_type = media_info
        if file_size <= 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El archivo multimedia no es reproducible o está vacío.",
            )

        range_header = request.headers.get("range")
        start = 0
        end = file_size - 1
        status_code = status.HTTP_200_OK

        if range_header:
            try:
                range_val = range_header.replace("bytes=", "").strip()
                parts = range_val.split("-")
                if parts[0].strip():
                    start = int(parts[0].strip())
                if len(parts) > 1 and parts[1].strip():
                    end = min(int(parts[1].strip()), file_size - 1)
                status_code = status.HTTP_206_PARTIAL_CONTENT
            except Exception:
                start = 0
                end = file_size - 1
                status_code = status.HTTP_200_OK

        content_length = (end - start) + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime_type,
            "Cache-Control": "public, max-age=86400",
        }

        return StreamingResponse(
            gateway.stream_media_range(client=client, media=media, start=start, length=content_length),
            status_code=status_code,
            headers=headers,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error streaming video for msg {message_id} in chat {chat_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al transmitir video MTProto: {str(e)}",
        )


@router.post("/{chat_id}/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message_endpoint(
    chat_id: int,
    req: SendChatMessageRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> ChatMessageResponse:
    """Send a text message to a chat/channel."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje no puede estar vacío.")

    try:
        msg = await gateway.send_text_message(chat_id, text)
        return ChatMessageResponse(
            id=msg.id,
            chat_id=chat_id,
            sender_id=999,
            sender_name="Yo",
            text=msg.text,
            date=msg.date or datetime.now().strftime("%H:%M"),
            is_outgoing=True,
            media_type="text",
        )
    except Exception as e:
        logger.warning(f"Error sending message to chat {chat_id} via MTProto: {e}. Using demo fallback.")
        new_id = int(datetime.now().timestamp() * 1000)
        demo_msg = ChatMessageResponse(
            id=new_id,
            chat_id=chat_id,
            sender_id=999,
            sender_name="Yo",
            text=text,
            date=datetime.now().strftime("%H:%M"),
            is_outgoing=True,
            media_type="text",
        )
        DEMO_MESSAGES.setdefault(chat_id, []).append(demo_msg)
        return demo_msg


@router.post("/{chat_id}/upload", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def upload_to_dialog_endpoint(
    chat_id: int,
    file: UploadFile | None = File(None),
    caption: str = Form(""),
    text: str = Form(""),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> ChatMessageResponse:
    """Upload a local media file (video/photo/document) or send message with media to a chat."""
    final_text = caption or text
    if not file and not final_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar un archivo multimedia o un texto para publicar.",
        )

    try:
        if file is not None and file.filename:
            suffix = Path(file.filename).suffix
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp_path = tmp.name
                content = await file.read()
                tmp.write(content)

            try:
                msg = await gateway.send_local_media(chat_id, tmp_path, caption=final_text)
            finally:
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass
        else:
            msg = await gateway.send_text_message(chat_id, final_text)

        return ChatMessageResponse(
            id=msg.id,
            chat_id=chat_id,
            sender_id=999,
            sender_name="Yo",
            text=msg.text,
            date=msg.date or datetime.now().strftime("%H:%M"),
            is_outgoing=True,
            media_type=msg.media_type,
        )
    except Exception as e:
        logger.warning(f"Error uploading media to chat {chat_id} via MTProto: {e}. Using demo fallback.")
        new_id = int(datetime.now().timestamp() * 1000)
        guessed_media = "document"
        if file and file.filename:
            fn = file.filename.lower()
            if fn.endswith((".mp4", ".mov", ".mkv", ".avi", ".webm")):
                guessed_media = "video"
            elif fn.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
                guessed_media = "photo"

        demo_msg = ChatMessageResponse(
            id=new_id,
            chat_id=chat_id,
            sender_id=999,
            sender_name="Yo",
            text=final_text or (f"[{guessed_media.capitalize()}]" if file else ""),
            date=datetime.now().strftime("%H:%M"),
            is_outgoing=True,
            media_type=guessed_media if file else "text",
        )
        DEMO_MESSAGES.setdefault(chat_id, []).append(demo_msg)
        return demo_msg


@router.delete("/{chat_id}/messages/{message_id}")
async def delete_dialog_message_endpoint(
    chat_id: int,
    message_id: int,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
):
    """Delete a message from a chat."""
    try:
        await gateway.delete_channel_message(chat_id, message_id)
    except Exception as e:
        logger.warning(f"Error deleting message {message_id} in chat {chat_id} via MTProto: {e}")

    # Remove from demo messages if present
    if chat_id in DEMO_MESSAGES:
        DEMO_MESSAGES[chat_id] = [m for m in DEMO_MESSAGES[chat_id] if m.id != message_id]

    return {"success": True, "chat_id": chat_id, "message_id": message_id}


@router.patch("/{chat_id}/messages/{message_id}", response_model=ChatMessageResponse)
async def edit_dialog_message_endpoint(
    chat_id: int,
    message_id: int,
    req: EditChatMessageRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> ChatMessageResponse:
    """Edit the caption or text of a message in a chat."""
    try:
        msg = await gateway.edit_channel_message(chat_id, message_id, req.text, account_id=req.account_id)
        return ChatMessageResponse(
            id=msg.id,
            chat_id=chat_id,
            sender_id=999,
            sender_name="Yo",
            text=msg.text,
            date=msg.date or datetime.now().strftime("%H:%M"),
            is_outgoing=True,
            media_type=msg.media_type,
        )
    except Exception as e:
        logger.warning(f"Error editing message {message_id} in chat {chat_id} via MTProto: {e}. Using demo fallback.")
        # If in demo messages, update it
        if chat_id in DEMO_MESSAGES:
            for m in DEMO_MESSAGES[chat_id]:
                if m.id == message_id:
                    m.text = req.text
                    return m

        return ChatMessageResponse(
            id=message_id,
            chat_id=chat_id,
            sender_id=999,
            sender_name="Yo",
            text=req.text,
            date=datetime.now().strftime("%H:%M"),
            is_outgoing=True,
            media_type="text",
        )


class ClickButtonRequest(BaseModel):
    button_text: str | None = None
    row: int | None = None
    col: int | None = None
    account_id: int | None = None


@router.post("/{chat_id}/messages/{message_id}/click-button")
async def click_message_button_endpoint(
    chat_id: int,
    message_id: int,
    req: ClickButtonRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Interact with a bot inline button (callback query) on a specific message."""
    success = await gateway.click_message_button(
        chat_id=chat_id,
        message_id=message_id,
        button_text=req.button_text,
        row=req.row,
        col=req.col,
        account_id=req.account_id,
    )
    return {"success": success, "chat_id": chat_id, "message_id": message_id}


@router.post("/{chat_id}/messages/forward")
async def forward_messages_endpoint(
    chat_id: int,
    req: ForwardMessagesRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Forward one or more messages to destination chat(s)/channel(s)."""
    if not req.message_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe especificar al menos un ID de mensaje para reenviar.",
        )
    if not req.target_chat_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe especificar al menos un chat de destino.",
        )

    try:
        forwarded = await gateway.forward_messages(
            source_chat_id=chat_id,
            target_chat_ids=req.target_chat_ids,
            message_ids=req.message_ids,
            account_id=req.account_id,
        )
        return {
            "success": True,
            "forwarded_count": len(forwarded),
            "forwarded_message_ids": forwarded,
        }
    except Exception as e:
        logger.error(f"Error forwarding messages from {chat_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al reenviar mensajes: {e}",
        )


@router.post("/check-invite")
async def check_invite_endpoint(
    req: CheckInviteRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Inspect a Telegram private or public invite link without joining yet."""
    url = req.invite_url.strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de invitación no puede estar vacío.",
        )

    try:
        info = await gateway.check_chat_invite(url, account_id=req.account_id)
        return {"success": True, "invite": info}
    except Exception as e:
        logger.warning(f"Error checking invite {url}: {e}")
        return {
            "success": False,
            "error": str(e),
            "invite": {"already_joined": False, "title": "Enlace no válido", "hash": url},
        }


@router.post("/join-invite")
async def join_invite_endpoint(
    req: JoinInviteRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Join a Telegram private invite link or public channel/group."""
    url = req.invite_url.strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de invitación no puede estar vacío.",
        )

    try:
        res = await gateway.join_chat_invite(url, account_id=req.account_id)
        return {"success": True, "result": res}
    except Exception as e:
        logger.error(f"Error joining invite {url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo unir al canal/grupo: {e}",
        )


@router.post("/resolve-message-link")
async def resolve_message_link_endpoint(
    req: ResolveMessageLinkRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Resolve a Telegram message permalink (e.g. t.me/canal/123) and fetch its message."""
    url = req.url.strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La URL del mensaje no puede estar vacía.",
        )

    try:
        result = await gateway.resolve_message_link(url, account_id=req.account_id)
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "No se pudo resolver el mensaje."),
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving message link {url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al resolver el mensaje: {e}",
        )


@router.post("/open-bot")
async def open_bot_endpoint(
    req: OpenBotRequest,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Start conversation with a Telegram bot inside the app, sending /start [payload]."""
    bot_username = req.bot_username.strip().lstrip("@")
    if not bot_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario del bot no puede estar vacío.",
        )

    try:
        result = await gateway.open_bot_start(
            bot_username=bot_username,
            start_param=req.start_param,
            account_id=req.account_id,
        )
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "No se pudo iniciar el bot."),
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error opening bot @{bot_username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al interactuar con el bot: {e}",
        )


@router.get("/{chat_id}/full-info")
async def get_chat_full_info_endpoint(
    chat_id: int,
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Retrieve full details, bio/description, participant counts and invite links for a chat."""
    try:
        info = await gateway.get_chat_full_info(chat_id=chat_id, account_id=account_id)
        return {"success": True, "chat": info}
    except Exception as e:
        logger.warning(f"Error fetching full info for chat {chat_id}: {e}")
        # Return fallback representation
        return {
            "success": True,
            "chat": {
                "id": chat_id,
                "title": f"Chat #{chat_id}",
                "type": "channel" if chat_id < 0 else "user",
                "about": None,
                "participants_count": None,
                "invite_link": None,
                "is_creator": False,
                "is_admin": False,
                "can_change_info": False,
            },
        }


@router.post("/{chat_id}/photo")
async def update_chat_photo_endpoint(
    chat_id: int,
    file: UploadFile = File(...),
    account_id: int | None = Query(None),
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> dict[str, Any]:
    """Upload and update the avatar/profile picture of a chat, channel, or user."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivo no válido")

    suffix = Path(file.filename).suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        content = await file.read()
        tmp.write(content)

    try:
        updated = await gateway.update_chat_photo(
            chat_id=chat_id,
            file_path=tmp_path,
            account_id=account_id,
        )
        return {"success": updated, "chat_id": chat_id}
    except Exception as e:
        logger.error(f"Error updating chat photo for {chat_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar foto del chat: {e}",
        )
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
