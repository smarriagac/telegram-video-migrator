from __future__ import annotations

import logging
from typing import Any
from telethon import TelegramClient

logger = logging.getLogger(__name__)


class TelegramClientPool:
    """Manages active Telethon client instances for multi-account operations."""

    def __init__(self) -> None:
        self._clients: dict[int, TelegramClient] = {}
        self._account_names: dict[int, str] = {}
        self._default_client: TelegramClient | None = None

    def register_client(
        self,
        account_id: int,
        account_name: str,
        client: TelegramClient,
        is_default: bool = False,
    ) -> None:
        """Register or update an active client in the pool."""
        self._clients[account_id] = client
        self._account_names[account_id] = account_name
        if is_default or self._default_client is None:
            self._default_client = client
        logger.info(f"Registered client for account #{account_id} ({account_name}) in pool.")

    def get_client(self, account_id: int | None = None) -> TelegramClient | None:
        """Retrieve a specific client by account_id, or the default client."""
        if account_id is not None and account_id in self._clients:
            return self._clients[account_id]
        return self._default_client

    def get_account_name(self, account_id: int) -> str | None:
        """Get descriptive name of a connected account."""
        return self._account_names.get(account_id)

    def list_clients(self) -> list[tuple[int, str, TelegramClient]]:
        """List all active clients in the pool as (account_id, account_name, client)."""
        return [
            (acc_id, self._account_names.get(acc_id, f"Cuenta #{acc_id}"), client)
            for acc_id, client in self._clients.items()
        ]

    def remove_client(self, account_id: int) -> None:
        """Remove a client from the pool."""
        self._clients.pop(account_id, None)
        self._account_names.pop(account_id, None)
        if self._default_client and account_id not in self._clients:
            self._default_client = next(iter(self._clients.values()), None)
