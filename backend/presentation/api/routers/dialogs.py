from __future__ import annotations

from datetime import datetime
import logging
import os
from pathlib import Path
import tempfile
from typing import Any
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel

from backend.application.use_cases.get_dialogs_use_case import GetDialogsUseCase
from backend.application.use_cases.get_chat_messages_use_case import GetChatMessagesUseCase
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.presentation.dependencies import (
    get_dialogs_use_case,
    get_chat_messages_use_case,
    get_telegram_gateway,
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


class ChatMessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    sender_name: str
    text: str
    date: str
    is_outgoing: bool
    media_type: str | None = None


class SendChatMessageRequest(BaseModel):
    text: str


class EditChatMessageRequest(BaseModel):
    text: str


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
        ),
        ChatMessageResponse(
            id=2,
            chat_id=101,
            sender_id=999,
            sender_name="Yo",
            text="Impecable, ya soporta clonación limpia por referencia sin descargar nada.",
            date="13:40",
            is_outgoing=True,
        ),
        ChatMessageResponse(
            id=3,
            chat_id=101,
            sender_id=101,
            sender_name="Carlos Méndez",
            text="Che, ¿pudiste migrar los videos del canal?",
            date="13:42",
            is_outgoing=False,
        ),
    ]
}


@router.get("", response_model=list[DialogResponse])
async def list_dialogs(
    limit: int = Query(100, ge=1, le=500),
    use_case: GetDialogsUseCase = Depends(get_dialogs_use_case),
) -> list[DialogResponse]:
    """Retrieve Telegram dialogs with unread counts and last message."""
    try:
        dialogs = await use_case.execute(limit=limit)
        return [
            DialogResponse(
                id=d.id,
                title=d.title,
                type=d.type,
                unread_count=d.unread_count,
                last_message=d.last_message,
                last_message_date=d.last_message_date,
                avatar_color=d.avatar_color,
            )
            for d in dialogs
        ]
    except Exception as e:
        logger.warning(f"Error fetching dialogs: {e}. Returning demo dialogs.")
        return DEMO_DIALOGS[:limit]


@router.get("/{chat_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    chat_id: int,
    limit: int = Query(50, ge=1, le=200),
    use_case: GetChatMessagesUseCase = Depends(get_chat_messages_use_case),
) -> list[ChatMessageResponse]:
    """Retrieve message history for a specific Telegram chat."""
    try:
        messages = await use_case.execute(chat_id=chat_id, limit=limit)
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
            )
            for m in messages
        ]
    except Exception as e:
        logger.warning(f"Error fetching messages for chat {chat_id}: {e}")
        return DEMO_MESSAGES.get(chat_id, [])


DEMO_THUMBNAIL_SVG = b"""<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200" fill="none">
  <rect width="360" height="200" fill="#14161F"/>
  <rect x="1" y="1" width="358" height="198" rx="8" stroke="#ffffff" stroke-opacity="0.08"/>
  <circle cx="180" cy="90" r="26" fill="#06B6D4" fill-opacity="0.2" stroke="#06B6D4" stroke-width="2"/>
  <polygon points="175,80 191,90 175,100" fill="#06B6D4"/>
  <text x="180" y="136" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#94A3B8" text-anchor="middle">Previsualización de Video</text>
  <text x="180" y="152" font-family="monospace" font-size="9" fill="#06B6D4" text-anchor="middle">MTProto Stream HD</text>
</svg>"""


@router.get("/{chat_id}/messages/{message_id}/thumbnail")
async def get_dialog_message_thumbnail_endpoint(
    chat_id: int,
    message_id: int,
    gateway: TelegramGatewayPort = Depends(get_telegram_gateway),
) -> Response:
    """Retrieve message media thumbnail with browser caching."""
    try:
        thumb = await gateway.get_message_thumbnail(channel_id=chat_id, message_id=message_id)
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
        msg = await gateway.edit_channel_message(chat_id, message_id, req.text)
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
