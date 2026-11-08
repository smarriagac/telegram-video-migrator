import asyncio
import time
from unittest.mock import AsyncMock, MagicMock
import pytest
from telethon.errors import FloodWaitError

from backend.infrastructure.telegram.telegram_client_pool import TelegramClientPool
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter


class TestTelegramClientPoolFloodWait:
    def test_cooldown_tracking_lifecycle(self):
        pool = TelegramClientPool()
        client1 = MagicMock()
        client2 = MagicMock()

        pool.register_client(1, "Account Alpha", client1)
        pool.register_client(2, "Account Beta", client2)

        # Initially no cooldowns
        is_cooling, rem = pool.is_account_on_cooldown(1)
        assert not is_cooling
        assert rem == 0

        # Mark Account 1 on cooldown
        pool.mark_flood_wait(1, 120)
        is_cooling, rem = pool.is_account_on_cooldown(1)
        assert is_cooling
        assert 118 <= rem <= 120

        # Account 2 remains active
        is_cooling_2, _ = pool.is_account_on_cooldown(2)
        assert not is_cooling_2

    def test_get_available_client_filters_cooldown(self):
        pool = TelegramClientPool()
        client1 = MagicMock()
        client2 = MagicMock()

        pool.register_client(1, "Account Alpha", client1)
        pool.register_client(2, "Account Beta", client2)

        # Mark Account 1 on cooldown
        pool.mark_flood_wait(1, 300)

        # get_available_client must select Account 2
        available = pool.get_available_client()
        assert available is not None
        acc_id, name, cl = available
        assert acc_id == 2
        assert name == "Account Beta"
        assert cl == client2

        # Exclude Account 2 -> should return None because Account 1 is in cooldown
        assert pool.get_available_client(exclude_account_id=2) is None

    def test_get_available_client_tenant_isolation(self):
        pool = TelegramClientPool()
        cl_t1_a = MagicMock()
        cl_t1_b = MagicMock()
        cl_t2_a = MagicMock()

        pool.register_client(10, "Tenant1 AccA", cl_t1_a, tenant_id="tenant_1")
        pool.register_client(11, "Tenant1 AccB", cl_t1_b, tenant_id="tenant_1")
        pool.register_client(20, "Tenant2 AccA", cl_t2_a, tenant_id="tenant_2")

        # In tenant 1, mark 10 on cooldown
        pool.mark_flood_wait(10, 60)

        available_t1 = pool.get_available_client(tenant_id="tenant_1")
        assert available_t1 is not None
        assert available_t1[0] == 11  # Must pick 11 from tenant_1, NEVER 20 from tenant_2

        # Mark 11 also on cooldown
        pool.mark_flood_wait(11, 60)
        assert pool.get_available_client(tenant_id="tenant_1") is None


class TestTelethonAdapterBroadcastFailover:
    @pytest.mark.asyncio
    async def test_broadcast_auto_rotates_on_flood_wait(self):
        pool = TelegramClientPool()

        # Mock client 1 that hits FloodWait on first target
        client1 = MagicMock()
        client1.is_connected.return_value = True
        client1.is_user_authorized = AsyncMock(return_value=True)
        client1.connect = AsyncMock()
        client1.get_input_entity = AsyncMock(side_effect=lambda tid: f"input_{tid}")
        client1.get_entity = AsyncMock(side_effect=lambda tid: f"entity_{tid}")
        client1.send_message = AsyncMock(side_effect=FloodWaitError(request=None, capture=45))

        # Mock client 2 that succeeds
        sent_msg_obj = MagicMock()
        sent_msg_obj.id = 999123
        client2 = MagicMock()
        client2.is_connected.return_value = True
        client2.is_user_authorized = AsyncMock(return_value=True)
        client2.connect = AsyncMock()
        client2.get_input_entity = AsyncMock(side_effect=lambda tid: f"input_{tid}")
        client2.get_entity = AsyncMock(side_effect=lambda tid: f"entity_{tid}")
        client2.send_message = AsyncMock(return_value=sent_msg_obj)

        pool.register_client(1, "Main Account", client1)
        pool.register_client(2, "Backup Account", client2)

        adapter = TelethonAdapter(client=client1, pool=pool)

        # Broadcast to 2 target channels starting with account #1
        res = await adapter.broadcast_message(
            target_ids=[-100111, -100222],
            text="Flash alert update",
            account_id=1,
            delay_seconds=0,
        )

        # Verify failover outcome
        assert res["total_targets"] == 2
        assert res["successful_count"] == 2
        assert res["failed_count"] == 0

        # Verify client 1 was placed on cooldown
        is_cooling, _ = pool.is_account_on_cooldown(1)
        assert is_cooling

        # Verify target 1 was recovered by account #2
        assert res["results"][0]["recovered_by_account"] == 2
        assert res["results"][0]["status"] == "success"
        assert res["results"][0]["message_id"] == 999123

        # Verify target 2 was directly sent by account #2
        assert res["results"][1]["status"] == "success"
        assert res["results"][1]["message_id"] == 999123

    @pytest.mark.asyncio
    async def test_broadcast_handles_all_accounts_in_flood_wait(self):
        pool = TelegramClientPool()

        client1 = MagicMock()
        client1.is_connected.return_value = True
        client1.is_user_authorized = AsyncMock(return_value=True)
        client1.connect = AsyncMock()
        client1.get_input_entity = AsyncMock(side_effect=lambda tid: f"input_{tid}")
        client1.send_message = AsyncMock(side_effect=FloodWaitError(request=None, capture=50))

        pool.register_client(1, "Only Account", client1)
        adapter = TelethonAdapter(client=client1, pool=pool)

        res = await adapter.broadcast_message(
            target_ids=[-100999],
            text="Important update",
            account_id=1,
            delay_seconds=0,
        )

        assert res["total_targets"] == 1
        assert res["successful_count"] == 0
        assert res["failed_count"] == 1
        assert "FloodWait (50s)" in res["results"][0]["error"]
