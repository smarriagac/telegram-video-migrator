from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.infrastructure.telegram.telegram_client_pool import TelegramClientPool
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter
from backend.domain.exceptions.domain_exceptions import ChannelAccessDeniedException


def test_telegram_client_pool_tenant_isolation():
    pool = TelegramClientPool()

    client_t1_a = MagicMock(name="client_t1_a")
    client_t1_b = MagicMock(name="client_t1_b")
    client_t2 = MagicMock(name="client_t2")

    # Register accounts for Tenant 1
    pool.register_client(
        account_id=1,
        account_name="Tenant 1 - Principal",
        client=client_t1_a,
        tenant_id="tenant-alpha",
        is_default=True,
    )
    pool.register_client(
        account_id=2,
        account_name="Tenant 1 - Backup",
        client=client_t1_b,
        tenant_id="tenant-alpha",
    )

    # Register account for Tenant 2
    pool.register_client(
        account_id=3,
        account_name="Tenant 2 - Main",
        client=client_t2,
        tenant_id="tenant-beta",
        is_default=True,
    )

    # 1. Tenant 1 can access its own accounts
    assert pool.get_client(account_id=1, tenant_id="tenant-alpha") is client_t1_a
    assert pool.get_client(account_id=2, tenant_id="tenant-alpha") is client_t1_b
    assert pool.get_client(account_id=None, tenant_id="tenant-alpha") is client_t1_a

    # 2. Strict Boundary: Tenant 1 CANNOT access Tenant 2's account
    assert pool.get_client(account_id=3, tenant_id="tenant-alpha") is None

    # 3. Strict Boundary: Tenant 2 CANNOT access Tenant 1's accounts
    assert pool.get_client(account_id=1, tenant_id="tenant-beta") is None
    assert pool.get_client(account_id=2, tenant_id="tenant-beta") is None
    assert pool.get_client(account_id=3, tenant_id="tenant-beta") is client_t2
    assert pool.get_client(account_id=None, tenant_id="tenant-beta") is client_t2

    # 4. Filtered listing per tenant
    t1_clients = pool.list_clients(tenant_id="tenant-alpha")
    assert len(t1_clients) == 2
    assert {c[0] for c in t1_clients} == {1, 2}

    t2_clients = pool.list_clients(tenant_id="tenant-beta")
    assert len(t2_clients) == 1
    assert t2_clients[0][0] == 3

    # 5. Ownership verification helper
    assert pool.is_account_owned_by_tenant(account_id=1, tenant_id="tenant-alpha") is True
    assert pool.is_account_owned_by_tenant(account_id=3, tenant_id="tenant-alpha") is False
    assert pool.get_account_tenant(account_id=3) == "tenant-beta"

    # 6. Safe removal
    pool.remove_client(account_id=1)
    assert pool.get_client(account_id=1, tenant_id="tenant-alpha") is None
    assert len(pool.list_clients(tenant_id="tenant-alpha")) == 1


@pytest.mark.asyncio
async def test_telethon_adapter_tenant_isolation_prevents_leakage():
    pool = TelegramClientPool()

    client_t1 = MagicMock(name="client_t1")
    client_t1.is_connected = MagicMock(return_value=True)
    client_t1.is_user_authorized = AsyncMock(return_value=True)

    client_t2 = MagicMock(name="client_t2")
    client_t2.is_connected = MagicMock(return_value=True)
    client_t2.is_user_authorized = AsyncMock(return_value=True)

    pool.register_client(1, "Alpha Account", client_t1, tenant_id="tenant-alpha", is_default=True)
    pool.register_client(2, "Beta Account", client_t2, tenant_id="tenant-beta", is_default=True)

    # Adapter scoped strictly to tenant-alpha
    adapter_alpha = TelethonAdapter(client=client_t1, pool=pool, tenant_id="tenant-alpha")

    # 1. Resolving own account succeeds
    assert adapter_alpha._get_client(account_id=1) is client_t1

    # 2. Resolving foreign account raises ChannelAccessDeniedException
    with pytest.raises(ChannelAccessDeniedException) as exc_info:
        adapter_alpha._get_client(account_id=2)
    assert "does not belong to tenant 'tenant-alpha'" in str(exc_info.value)


@pytest.mark.asyncio
async def test_telethon_adapter_get_managed_channels_tenant_scoped():
    pool = TelegramClientPool()

    client_t1 = MagicMock(name="client_t1")
    client_t1.is_connected = MagicMock(return_value=True)
    client_t1.is_user_authorized = AsyncMock(return_value=True)
    dialog_1 = MagicMock()
    dialog_1.is_channel = True
    dialog_1.id = -100111
    dialog_1.name = "Alpha News"
    dialog_1.entity = MagicMock(creator=True)
    client_t1.get_dialogs = AsyncMock(return_value=[dialog_1])

    client_t2 = MagicMock(name="client_t2")
    client_t2.is_connected = MagicMock(return_value=True)
    client_t2.is_user_authorized = AsyncMock(return_value=True)
    dialog_2 = MagicMock()
    dialog_2.is_channel = True
    dialog_2.id = -100222
    dialog_2.name = "Beta Private Channel"
    dialog_2.entity = MagicMock(creator=True)
    client_t2.get_dialogs = AsyncMock(return_value=[dialog_2])

    pool.register_client(1, "Alpha Account", client_t1, tenant_id="tenant-alpha", is_default=True)
    pool.register_client(2, "Beta Account", client_t2, tenant_id="tenant-beta", is_default=True)

    # Scoped adapter for Tenant Alpha
    adapter_alpha = TelethonAdapter(client=client_t1, pool=pool, tenant_id="tenant-alpha")
    channels = await adapter_alpha.get_managed_channels()

    # Must only return Tenant Alpha's channels (Alpha News), never Beta's!
    assert len(channels) == 1
    assert channels[0].id == -100111
    assert channels[0].title == "Alpha News"
    assert channels[0].account_id == 1
