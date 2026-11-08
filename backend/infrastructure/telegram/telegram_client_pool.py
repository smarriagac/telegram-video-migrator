from __future__ import annotations

import logging
import time
from typing import Any
from telethon import TelegramClient

logger = logging.getLogger(__name__)


class TelegramClientPool:
    """Manages active Telethon client instances with tenant-level isolation for multi-account operations."""

    def __init__(self) -> None:
        # Global/legacy mappings for backwards compatibility
        self._clients: dict[int, TelegramClient] = {}
        self._account_names: dict[int, str] = {}
        self._default_client: TelegramClient | None = None

        # Tenant-isolated registries: tenant_id -> {account_id: client}
        self._tenant_clients: dict[str, dict[int, TelegramClient]] = {}
        self._tenant_account_names: dict[str, dict[int, str]] = {}
        self._tenant_default_client: dict[str, TelegramClient] = {}
        self._account_tenant_map: dict[int, str] = {}

        # FloodWait cooldown registry: account_id -> epoch_time_until
        self._flood_wait_until: dict[int, float] = {}

    def register_client(
        self,
        account_id: int,
        account_name: str,
        client: TelegramClient,
        tenant_id: str | None = None,
        is_default: bool = False,
    ) -> None:
        """Register or update an active client in the pool, optionally isolated by tenant."""
        self._clients[account_id] = client
        self._account_names[account_id] = account_name
        if is_default or self._default_client is None:
            self._default_client = client

        if tenant_id:
            tid = str(tenant_id)
            if tid not in self._tenant_clients:
                self._tenant_clients[tid] = {}
                self._tenant_account_names[tid] = {}

            self._tenant_clients[tid][account_id] = client
            self._tenant_account_names[tid][account_id] = account_name
            self._account_tenant_map[account_id] = tid

            if is_default or tid not in self._tenant_default_client:
                self._tenant_default_client[tid] = client

            logger.info(
                f"Registered client for account #{account_id} ('{account_name}') under tenant '{tid}' (default={is_default})."
            )
        else:
            logger.info(f"Registered client for account #{account_id} ('{account_name}') in global pool.")

    def get_client(
        self,
        account_id: int | None = None,
        tenant_id: str | None = None,
    ) -> TelegramClient | None:
        """
        Retrieve a specific client with strict tenant isolation.
        
        If tenant_id is provided:
        - When account_id is specified: returns the client ONLY if it belongs to tenant_id.
          Never falls back to another tenant's client.
        - When account_id is None: returns the tenant's default client.
        
        If tenant_id is omitted (legacy single-tenant / system mode):
        - Returns client by account_id, or the global default client.
        """
        if tenant_id is not None:
            tid = str(tenant_id)
            tenant_pool = self._tenant_clients.get(tid, {})
            if account_id is not None:
                # Strict tenant boundary: never leak other tenants' clients
                return tenant_pool.get(account_id)
            return self._tenant_default_client.get(tid)

        # Legacy / un-scoped access
        if account_id is not None and account_id in self._clients:
            return self._clients[account_id]
        return self._default_client

    def get_account_name(self, account_id: int) -> str | None:
        """Get descriptive name of a connected account."""
        return self._account_names.get(account_id)

    def get_account_tenant(self, account_id: int) -> str | None:
        """Retrieve the tenant_id that owns the specified account_id."""
        return self._account_tenant_map.get(account_id)

    def is_account_owned_by_tenant(self, account_id: int, tenant_id: str) -> bool:
        """Check if an account belongs to a specific tenant."""
        return self._account_tenant_map.get(account_id) == str(tenant_id)

    def list_clients(self, tenant_id: str | None = None) -> list[tuple[int, str, TelegramClient]]:
        """
        List active clients. If tenant_id is provided, returns ONLY clients belonging to that tenant.
        Returns tuples of (account_id, account_name, client).
        """
        if tenant_id is not None:
            tid = str(tenant_id)
            tenant_pool = self._tenant_clients.get(tid, {})
            names = self._tenant_account_names.get(tid, {})
            return [
                (acc_id, names.get(acc_id, f"Cuenta #{acc_id}"), client)
                for acc_id, client in tenant_pool.items()
            ]

        return [
            (acc_id, self._account_names.get(acc_id, f"Cuenta #{acc_id}"), client)
            for acc_id, client in self._clients.items()
        ]

    def mark_flood_wait(self, account_id: int, seconds: int) -> None:
        """Mark an account as on cooldown due to Telegram FloodWait."""
        until = time.time() + max(1.0, float(seconds))
        self._flood_wait_until[account_id] = until
        logger.warning(
            f"Account #{account_id} placed on FloodWait cooldown for {seconds}s (until epoch {until:.1f})."
        )

    def is_account_on_cooldown(self, account_id: int) -> tuple[bool, int]:
        """Check if an account is currently in cooldown. Returns (is_cooling, remaining_seconds)."""
        until = self._flood_wait_until.get(account_id, 0.0)
        remaining = int(until - time.time())
        if remaining > 0:
            return True, remaining
        # Clean expired entry
        if account_id in self._flood_wait_until:
            del self._flood_wait_until[account_id]
        return False, 0

    def get_account_id_for_client(self, client: TelegramClient) -> int | None:
        """Lookup account_id matching a given client instance."""
        for acc_id, c in self._clients.items():
            if c is client:
                return acc_id
        return None

    def get_available_client(
        self,
        tenant_id: str | None = None,
        exclude_account_id: int | None = None,
    ) -> tuple[int, str, TelegramClient] | None:
        """
        Find an active connected client not currently constrained by FloodWait cooldown.
        Supports strict tenant scoping and excluding a specific account (e.g. during failover).
        """
        candidates = self.list_clients(tenant_id=tenant_id)
        for acc_id, name, client in candidates:
            if exclude_account_id is not None and acc_id == exclude_account_id:
                continue
            is_cooling, remaining = self.is_account_on_cooldown(acc_id)
            if not is_cooling:
                return acc_id, name, client
            logger.debug(
                f"Candidate account #{acc_id} skipped: FloodWait cooldown active ({remaining}s remaining)."
            )
        return None

    def remove_client(self, account_id: int) -> None:
        """Remove a client from the pool across all global and tenant registries."""
        self._flood_wait_until.pop(account_id, None)
        client = self._clients.pop(account_id, None)
        self._account_names.pop(account_id, None)

        tid = self._account_tenant_map.pop(account_id, None)
        if tid and tid in self._tenant_clients:
            self._tenant_clients[tid].pop(account_id, None)
            self._tenant_account_names[tid].pop(account_id, None)
            if self._tenant_default_client.get(tid) == client:
                self._tenant_default_client[tid] = next(iter(self._tenant_clients[tid].values()), None)

        if self._default_client == client:
            self._default_client = next(iter(self._clients.values()), None)
