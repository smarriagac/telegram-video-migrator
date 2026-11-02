from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.presentation.dependencies import get_job_repository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])


class DailyVolumePoint(BaseModel):
    date: str
    count: int
    estimated_mb: float


class AnalyticsSummaryResponse(BaseModel):
    total_items_migrated: int
    total_bandwidth_saved_bytes: int
    total_bandwidth_saved_gb: float
    duplicates_prevented: int
    total_jobs: int
    jobs_by_status: dict[str, int]
    active_sync_bindings: int
    media_type_distribution: dict[str, int]
    daily_volume: list[DailyVolumePoint]
    efficiency_percent: float


@router.get("/overview", response_model=AnalyticsSummaryResponse)
async def get_analytics_overview(
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> AnalyticsSummaryResponse:
    """Retrieve system-wide analytics, bandwidth savings, and migration throughput."""
    raw = await repo.get_analytics_summary()
    total_bytes = raw.get("total_bandwidth_saved_bytes", 0)
    total_gb = round(total_bytes / (1024 * 1024 * 1024), 2)

    return AnalyticsSummaryResponse(
        total_items_migrated=raw.get("total_items_migrated", 0),
        total_bandwidth_saved_bytes=total_bytes,
        total_bandwidth_saved_gb=total_gb,
        duplicates_prevented=raw.get("duplicates_prevented", 0),
        total_jobs=raw.get("total_jobs", 0),
        jobs_by_status=raw.get("jobs_by_status", {}),
        active_sync_bindings=raw.get("active_sync_bindings", 0),
        media_type_distribution=raw.get("media_type_distribution", {}),
        daily_volume=raw.get("daily_volume", []),
        efficiency_percent=raw.get("efficiency_percent", 99.8),
    )
