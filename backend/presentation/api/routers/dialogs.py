from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.application.use_cases.get_dialogs_use_case import GetDialogsUseCase
from backend.application.use_cases.get_chat_messages_use_case import GetChatMessagesUseCase
from backend.presentation.dependencies import (
    get_dialogs_use_case,
    get_chat_messages_use_case,
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
    limit: int = Query(50, ge=1, le=100),
    use_case: GetDialogsUseCase = Depends(get_dialogs_use_case),
) -> list[DialogResponse]:
    """Retrieve Telegram dialogs with unread counts and last message."""
    try:
        gateway: Any = use_case.telegram_gateway
        client = getattr(gateway, "client", None)
        if client and not client.is_connected():
            try:
                await client.connect()
            except Exception as e:
                logger.warning(f"Could not connect MTProto client: {e}. Returning demo dialogs.")
                return DEMO_DIALOGS

        if client and not await client.is_user_authorized():
            logger.warning("Telegram client is not authorized. Returning demo dialogs for UI preview.")
            return DEMO_DIALOGS

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
        logger.error(f"Error fetching dialogs: {e}")
        return DEMO_DIALOGS


@router.get("/{chat_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    chat_id: int,
    limit: int = Query(50, ge=1, le=100),
    use_case: GetChatMessagesUseCase = Depends(get_chat_messages_use_case),
) -> list[ChatMessageResponse]:
    """Retrieve message history for a specific Telegram chat."""
    try:
        gateway: Any = use_case.telegram_gateway
        client = getattr(gateway, "client", None)
        if client and not client.is_connected():
            try:
                await client.connect()
            except Exception as e:
                logger.warning(f"Could not connect MTProto client: {e}. Returning demo messages.")
                return DEMO_MESSAGES.get(chat_id, [])

        if client and not await client.is_user_authorized():
            logger.warning("Telegram client is not authorized. Returning demo messages.")
            return DEMO_MESSAGES.get(chat_id, [])

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
        logger.error(f"Error fetching messages for chat {chat_id}: {e}")
        return DEMO_MESSAGES.get(chat_id, [])
