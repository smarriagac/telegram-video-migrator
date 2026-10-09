from __future__ import annotations

from backend.domain.entities.dialog import TelegramDialog
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort


class GetDialogsUseCase:
    """Use case for retrieving user Telegram dialogs."""

    def __init__(self, telegram_gateway: TelegramGatewayPort) -> None:
        self.telegram_gateway = telegram_gateway

    async def execute(self, limit: int = 50) -> list[TelegramDialog]:
        return await self.telegram_gateway.get_dialogs(limit=limit)
