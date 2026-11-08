from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.application.services.rate_governor_service import (
    RateGovernorService,
    get_rate_governor_service,
)
from backend.presentation.dependencies import get_rate_governor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system/rate-governor", tags=["Rate Governor & Concurrency"])


class ChannelThrottleResponse(BaseModel):
    account_id: int | str | None
    target_id: str
    capacity: float
    tokens: float
    refill_rate: float
    backoff_multiplier: float
    consecutive_successes: int
    consecutive_failures: int
    remaining_freeze_seconds: float
    total_dispatches: int
    total_flood_waits: int
    ema_latency_ms: float
    status: str


class BandwidthTelemetryResponse(BaseModel):
    limit_bytes_per_sec: int
    limit_mb_per_sec: float
    is_unlimited: bool
    current_rate_mb_per_sec: float
    current_rate_bytes_per_sec: float
    total_bytes_transferred: int
    total_mb_transferred: float


class UpdateBandwidthLimitRequest(BaseModel):
    limit_mb_per_sec: float | None = None  # None or 0 = unlimited


class RateGovernorStatusResponse(BaseModel):
    total_managed_channels: int
    active_throttles: int
    frozen_channels: int
    channels: list[ChannelThrottleResponse]
    bandwidth: BandwidthTelemetryResponse | None = None


class ResetRateGovernorRequest(BaseModel):
    account_id: int | str | None = None
    target_id: str | None = None


@router.get("", response_model=RateGovernorStatusResponse)
async def get_rate_governor_status(
    governor: RateGovernorService = Depends(get_rate_governor),
) -> RateGovernorStatusResponse:
    """Telemetry snapshot of adaptive token buckets, active throttles, flood wait cooldowns, and network bandwidth."""
    return RateGovernorStatusResponse(**governor.get_status())


@router.get("/bandwidth", response_model=BandwidthTelemetryResponse)
async def get_bandwidth_status(
    governor: RateGovernorService = Depends(get_rate_governor),
) -> BandwidthTelemetryResponse:
    """Get real-time bandwidth egress rate and configured limit."""
    return BandwidthTelemetryResponse(**governor.bandwidth_shaper.get_telemetry())


@router.put("/bandwidth", response_model=BandwidthTelemetryResponse)
async def update_bandwidth_limit(
    payload: UpdateBandwidthLimitRequest,
    governor: RateGovernorService = Depends(get_rate_governor),
) -> BandwidthTelemetryResponse:
    """Update global network transfer speed limit in MB/s (0 or null = unlimited)."""
    res = governor.set_bandwidth_limit_mbps(payload.limit_mb_per_sec)
    return BandwidthTelemetryResponse(**res)


@router.post("/reset")
async def reset_rate_governor(
    payload: ResetRateGovernorRequest,
    governor: RateGovernorService = Depends(get_rate_governor),
) -> dict[str, Any]:
    """Reset backoff and freeze cooldown for a specific target channel or all channels."""
    if payload.target_id:
        ok = governor.reset_channel(payload.account_id, payload.target_id)
        return {
            "success": ok,
            "target_id": payload.target_id,
            "message": "Channel throttle reset to baseline.",
        }
    else:
        count = governor.reset_all()
        return {
            "success": True,
            "reset_count": count,
            "message": f"All {count} channel throttle states reset to baseline.",
        }
