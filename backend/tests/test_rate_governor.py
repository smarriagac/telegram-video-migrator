from __future__ import annotations

import asyncio
import time
import pytest
from httpx import AsyncClient, ASGITransport

from backend.application.services.rate_governor_service import (
    RateGovernorService,
    ChannelThrottleState,
)
from backend.main import app


@pytest.mark.asyncio
async def test_rate_governor_token_bucket_acquisition():
    governor = RateGovernorService(default_capacity=3.0, default_refill_rate=10.0)

    # First acquisition with plenty of tokens in bucket
    delay = await governor.acquire(account_id=1, target_id="target_chan_1", requested_delay=0.0)
    assert delay == 0.0

    state = governor.get_channel_state(account_id=1, target_id="target_chan_1")
    assert state is not None
    assert state.status == "HEALTHY"
    assert state.tokens < 3.0
    assert state.backoff_multiplier == 1.0


@pytest.mark.asyncio
async def test_rate_governor_aimd_multiplicative_decrease_and_freeze():
    governor = RateGovernorService(default_capacity=2.0, default_refill_rate=1.0)

    target = "chan_flood_test"
    # Report a FloodWait of 1 second
    await governor.report_feedback(
        account_id=1,
        target_id=target,
        success=False,
        flood_wait_seconds=1.0,
    )

    state = governor.get_channel_state(account_id=1, target_id=target)
    assert state.status == "FROZEN"
    assert state.backoff_multiplier >= 1.5
    assert state.total_flood_waits == 1
    assert state.consecutive_successes == 0

    # Acquire should wait out the freeze
    start = time.monotonic()
    applied_delay = await governor.acquire(account_id=1, target_id=target, requested_delay=0.0)
    elapsed = time.monotonic() - start

    assert elapsed >= 0.8  # Slept through freeze
    # After freeze expires, state becomes THROTTLED (since backoff > 1.0)
    assert state.status == "THROTTLED"


@pytest.mark.asyncio
async def test_rate_governor_aimd_additive_recovery():
    governor = RateGovernorService(default_capacity=5.0, default_refill_rate=2.0)
    target = "chan_recovery_test"

    # Trigger a throttle
    await governor.report_feedback(account_id=1, target_id=target, success=False, flood_wait_seconds=0.1)
    state = governor.get_channel_state(account_id=1, target_id=target)
    initial_backoff = state.backoff_multiplier
    assert initial_backoff > 1.0

    # Wait out the short freeze
    await asyncio.sleep(0.2)

    # 5 consecutive successes should trigger additive recovery
    for _ in range(5):
        await governor.report_feedback(account_id=1, target_id=target, success=True, latency_ms=45.0)

    state = governor.get_channel_state(account_id=1, target_id=target)
    assert state.consecutive_successes == 5
    assert state.backoff_multiplier < initial_backoff
    assert state.ema_latency_ms > 0.0


@pytest.mark.asyncio
async def test_rate_governor_manual_reset():
    governor = RateGovernorService()
    target = "chan_reset_test"

    await governor.report_feedback(account_id=1, target_id=target, success=False, flood_wait_seconds=10.0)
    state = governor.get_channel_state(account_id=1, target_id=target)
    assert state.status == "FROZEN"

    ok = governor.reset_channel(account_id=1, target_id=target)
    assert ok is True

    state = governor.get_channel_state(account_id=1, target_id=target)
    assert state.status == "HEALTHY"
    assert state.backoff_multiplier == 1.0
    assert state.frozen_until <= time.monotonic()


@pytest.mark.asyncio
async def test_rate_governor_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # GET status
        res = await client.get("/api/system/rate-governor")
        assert res.status_code == 200
        data = res.json()
        assert "total_managed_channels" in data
        assert "channels" in data
        assert isinstance(data["channels"], list)

        # POST reset
        reset_res = await client.post("/api/system/rate-governor/reset", json={})
        assert reset_res.status_code == 200
        reset_data = reset_res.json()
        assert reset_data.get("success") is True
