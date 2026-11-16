from __future__ import annotations

from typing import Any
from backend.domain.entities.chat_message import ChatMessage
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort


class GetChatMessagesUseCase:
    """Use case for retrieving message history of a specific chat."""

    def __init__(self, telegram_gateway: TelegramGatewayPort) -> None:
        self.telegram_gateway = telegram_gateway

    async def execute(
        self,
        chat_id: int,
        limit: int = 50,
        offset_id: int | None = None,
        account_id: int | None = None,
        search_query: str | None = None,
        add_offset: int | None = None,
    ) -> list[ChatMessage]:
        kwargs: dict[str, Any] = {"chat_id": chat_id, "limit": limit}
        if offset_id is not None:
            kwargs["offset_id"] = offset_id
        if account_id is not None:
            kwargs["account_id"] = account_id
        if search_query is not None:
            kwargs["search_query"] = search_query
        if add_offset is not None:
            kwargs["add_offset"] = add_offset
        return await self.telegram_gateway.get_chat_messages(**kwargs)
