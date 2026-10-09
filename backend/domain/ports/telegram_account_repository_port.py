from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.telegram_account import TelegramAccount


class TelegramAccountRepositoryPort(ABC):
    @abstractmethod
    async def save_account(self, account: TelegramAccount) -> TelegramAccount:
        raise NotImplementedError

    @abstractmethod
    async def get_active_account(self) -> TelegramAccount | None:
        raise NotImplementedError

    @abstractmethod
    async def list_accounts(self) -> list[TelegramAccount]:
        raise NotImplementedError
