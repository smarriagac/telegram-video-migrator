from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from backend.application.broadcaster import EventBroadcaster, broadcaster

logger = logging.getLogger(__name__)


@dataclass
class ChannelThrottleState:
    account_id: int | str | None
    target_id: int | str
    capacity: float = 5.0
    tokens: float = 5.0
    refill_rate: float = 0.5  # tokens per second (1 msg / 2s baseline)
    last_refill: float = field(default_factory=time.monotonic)
    backoff_multiplier: float = 1.0
    consecutive_successes: int = 0
    consecutive_failures: int = 0
    frozen_until: float = 0.0
    total_dispatches: int = 0
    total_flood_waits: int = 0
    ema_latency_ms: float = 0.0
    status: str = "HEALTHY"  # "HEALTHY" | "THROTTLED" | "FROZEN"

    def to_dict(self) -> dict[str, Any]:
        now = time.monotonic()
        remaining_freeze = max(0.0, round(self.frozen_until - now, 1)) if self.frozen_until > now else 0.0
        return {
            "account_id": self.account_id,
            "target_id": str(self.target_id),
            "capacity": self.capacity,
            "tokens": round(self.tokens, 2),
            "refill_rate": round(self.refill_rate, 2),
            "backoff_multiplier": round(self.backoff_multiplier, 2),
            "consecutive_successes": self.consecutive_successes,
            "consecutive_failures": self.consecutive_failures,
            "remaining_freeze_seconds": remaining_freeze,
            "total_dispatches": self.total_dispatches,
            "total_flood_waits": self.total_flood_waits,
            "ema_latency_ms": round(self.ema_latency_ms, 1),
            "status": self.status,
        }


class RateGovernorService:
    """
    Centralized Adaptive Rate Governor & Concurrency Throttle for Telegram operations.
    Implements a Token Bucket combined with AIMD (Additive Increase / Multiplicative Decrease)
    and global account/target freezing on FloodWait.
    """

    def __init__(
        self,
        default_capacity: float = 5.0,
        default_refill_rate: float = 0.5,
        broadcaster_instance: EventBroadcaster | None = None,
    ) -> None:
        self.default_capacity = default_capacity
        self.default_refill_rate = default_refill_rate
        self.broadcaster = broadcaster_instance or broadcaster
        self._states: dict[str, ChannelThrottleState] = {}
        self._lock = asyncio.Lock()

    def _get_key(self, account_id: int | str | None, target_id: int | str) -> str:
        acc = str(account_id) if account_id is not None else "default"
        return f"{acc}:{target_id}"

    def get_channel_state(
        self, account_id: int | str | None, target_id: int | str
    ) -> ChannelThrottleState | None:
        key = self._get_key(account_id, target_id)
        return self._states.get(key)

    def _ensure_channel_state(
        self, account_id: int | str | None, target_id: int | str
    ) -> ChannelThrottleState:
        key = self._get_key(account_id, target_id)
        if key not in self._states:
            self._states[key] = ChannelThrottleState(
                account_id=account_id,
                target_id=target_id,
                capacity=self.default_capacity,
                tokens=self.default_capacity,
                refill_rate=self.default_refill_rate,
                last_refill=time.monotonic(),
            )
        return self._states[key]

    async def acquire(
        self,
        account_id: int | str | None,
        target_id: int | str,
        requested_delay: float = 0.0,
    ) -> float:
        """
        Cooperative acquisition before dispatching a Telegram payload.
        Ensures non-blocking wait if bucket is depleted or if channel is frozen by FloodWait.
        Returns the total delay (seconds) slept.
        """
        async with self._lock:
            state = self._ensure_channel_state(account_id, target_id)
            now = time.monotonic()

            # 1. Check if frozen by FloodWait
            if state.frozen_until > now:
                freeze_wait = state.frozen_until - now
                logger.info(
                    f"RateGovernor: Target {target_id} (account {account_id}) is FROZEN. Waiting {freeze_wait:.2f}s..."
                )
                await asyncio.sleep(freeze_wait)
                now = time.monotonic()
                state.frozen_until = 0.0
                state.status = "THROTTLED" if state.backoff_multiplier > 1.0 else "HEALTHY"

            # 2. Refill tokens
            elapsed = now - state.last_refill
            state.tokens = min(state.capacity, state.tokens + elapsed * state.refill_rate)
            state.last_refill = now

            # 3. Calculate delay based on token availability and backoff multiplier
            delay_to_sleep = 0.0
            if state.tokens < 1.0:
                # Need to wait for at least 1 token
                wait_for_token = (1.0 - state.tokens) / state.refill_rate
                delay_to_sleep = max(delay_to_sleep, wait_for_token)

            if requested_delay > 0:
                delay_to_sleep = max(delay_to_sleep, requested_delay * state.backoff_multiplier)
            elif state.backoff_multiplier > 1.0:
                base_delay = 1.0 / max(0.1, state.refill_rate)
                delay_to_sleep = max(delay_to_sleep, base_delay * (state.backoff_multiplier - 1.0))

            if delay_to_sleep > 0:
                await asyncio.sleep(delay_to_sleep)
                # Refill after sleeping
                now_after = time.monotonic()
                state.tokens = min(
                    state.capacity,
                    state.tokens + (now_after - state.last_refill) * state.refill_rate,
                )
                state.last_refill = now_after

            # 4. Consume 1 token
            state.tokens = max(0.0, state.tokens - 1.0)
            return delay_to_sleep

    async def report_feedback(
        self,
        account_id: int | str | None,
        target_id: int | str,
        success: bool,
        flood_wait_seconds: float = 0.0,
        latency_ms: float = 0.0,
    ) -> None:
        """
        Feedback report from worker after Telegram operation completes.
        Applies AIMD: Multiplicative Decrease on FloodWait, Additive Increase on consecutive successes.
        """
        async with self._lock:
            state = self._ensure_channel_state(account_id, target_id)
            now = time.monotonic()

            if not success or flood_wait_seconds > 0:
                # Multiplicative Decrease
                state.consecutive_successes = 0
                state.consecutive_failures += 1
                if flood_wait_seconds > 0:
                    state.total_flood_waits += 1
                    state.frozen_until = now + flood_wait_seconds + 0.5
                    state.status = "FROZEN"
                else:
                    state.status = "THROTTLED"

                # Increase backoff by 1.5x up to 8.0x max
                state.backoff_multiplier = min(8.0, state.backoff_multiplier * 1.5)
                # Decrease refill rate by 30% (min 0.1 tokens/sec)
                state.refill_rate = max(0.1, state.refill_rate * 0.7)

                logger.warning(
                    f"RateGovernor [AIMD Backoff]: Target {target_id} throttled. "
                    f"Backoff: {state.backoff_multiplier:.2f}x, Refill: {state.refill_rate:.2f}/s, "
                    f"Frozen: {flood_wait_seconds:.1f}s"
                )

                if self.broadcaster and hasattr(self.broadcaster, "broadcast"):
                    try:
                        await self.broadcaster.broadcast(
                            "rate_limit_event",
                            {
                                "type": "RATE_LIMIT_ADAPTED",
                                "target_id": str(target_id),
                                "account_id": account_id,
                                "status": state.status,
                                "backoff_multiplier": state.backoff_multiplier,
                                "frozen_seconds": flood_wait_seconds,
                            },
                        )
                    except Exception as e:
                        logger.debug(f"RateGovernor: broadcast suppressed: {e}")

            else:
                # Success
                state.total_dispatches += 1
                state.consecutive_successes += 1
                state.consecutive_failures = 0

                # Update Exponential Moving Average (EMA) of latency
                if latency_ms > 0:
                    if state.ema_latency_ms == 0.0:
                        state.ema_latency_ms = latency_ms
                    else:
                        state.ema_latency_ms = (state.ema_latency_ms * 0.8) + (latency_ms * 0.2)

                # Additive Recovery: every 5 consecutive successes, relax backoff and restore refill rate
                if state.consecutive_successes % 5 == 0:
                    if state.backoff_multiplier > 1.0:
                        state.backoff_multiplier = max(1.0, state.backoff_multiplier - 0.2)
                    if state.refill_rate < self.default_refill_rate:
                        state.refill_rate = min(self.default_refill_rate, state.refill_rate + 0.05)

                if state.frozen_until <= now:
                    state.status = "HEALTHY" if state.backoff_multiplier <= 1.05 else "THROTTLED"

    def get_status(self) -> dict[str, Any]:
        """Telemetry snapshot of all managed channels."""
        now = time.monotonic()
        channel_list = []
        active_throttles = 0
        frozen_count = 0

        for state in self._states.values():
            d = state.to_dict()
            if state.frozen_until > now:
                frozen_count += 1
            elif state.backoff_multiplier > 1.05:
                active_throttles += 1
            channel_list.append(d)

        return {
            "total_managed_channels": len(self._states),
            "active_throttles": active_throttles,
            "frozen_channels": frozen_count,
            "channels": channel_list,
        }

    def reset_channel(self, account_id: int | str | None, target_id: int | str) -> bool:
        """Reset state for a specific target channel."""
        key = self._get_key(account_id, target_id)
        if key in self._states:
            state = self._states[key]
            state.tokens = state.capacity
            state.refill_rate = self.default_refill_rate
            state.backoff_multiplier = 1.0
            state.frozen_until = 0.0
            state.status = "HEALTHY"
            state.consecutive_failures = 0
            state.last_refill = time.monotonic()
            return True
        return False

    def reset_all(self) -> int:
        """Reset all managed channel throttle states."""
        count = len(self._states)
        for state in self._states.values():
            state.tokens = state.capacity
            state.refill_rate = self.default_refill_rate
            state.backoff_multiplier = 1.0
            state.frozen_until = 0.0
            state.status = "HEALTHY"
            state.consecutive_failures = 0
            state.last_refill = time.monotonic()
        return count


# Singleton instance
_rate_governor: RateGovernorService | None = None


def get_rate_governor_service() -> RateGovernorService:
    global _rate_governor
    if _rate_governor is None:
        _rate_governor = RateGovernorService()
    return _rate_governor
