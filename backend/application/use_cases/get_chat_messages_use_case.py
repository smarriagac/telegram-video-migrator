from __future__ import annotations

from backend.domain.entities.chat_message import ChatMessage
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort


class GetChatMessagesUseCase:
    """Use case for retrieving message history of a specific chat."""

    def __init__(self, telegram_gateway: TelegramGatewayPort) -> None:
        self.telegram_gateway = telegram_gateway

    async def execute(self, chat_id: int, limit: int = 50) -> list[ChatMessage]:
        return await self.telegram_gateway.get_chat_messages(chat_id=chat_id, limit=limit)
