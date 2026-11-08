from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any
from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel

from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.application.services.report_exporter_service import ReportExporterService
from backend.presentation.dependencies import get_job_repository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])


class DailyVolumePoint(BaseModel):
    date: str
    count: int
    estimated_mb: float


class RecentTransferItem(BaseModel):
    job_id: str
    source_channel_id: int
    target_channel_id: int
    source_title: str
    target_title: str
    status: str
    total_videos: int
    processed_videos: int
    estimated_mb: float
    created_at: str


class TopChannelTrafficItem(BaseModel):
    channel_id: int
    title: str
    total_items: int
    volume_gb: float


class PipelineHealthMetrics(BaseModel):
    local_io_bypass_percent: float = 100.0
    avg_speed_sec_per_item: float = 1.8
    push_daemon_status: str = "ONLINE"


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
    recent_transfers: list[RecentTransferItem] = []
    top_channels: list[TopChannelTrafficItem] = []
    pipeline_health: PipelineHealthMetrics = PipelineHealthMetrics()


@router.get("/overview", response_model=AnalyticsSummaryResponse)
async def get_analytics_overview(
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> AnalyticsSummaryResponse:
    """Retrieve system-wide analytics, bandwidth savings, and migration throughput."""
    raw = await repo.get_analytics_summary()
    total_bytes = raw.get("total_bandwidth_saved_bytes", 0)
    total_gb = round(total_bytes / (1024 * 1024 * 1024), 2)

    raw_transfers = raw.get("recent_transfers", [])
    recent_transfers = [
        RecentTransferItem(
            job_id=t.get("job_id", ""),
            source_channel_id=t.get("source_channel_id", 0),
            target_channel_id=t.get("target_channel_id", 0),
            source_title=t.get("source_title", "Origen"),
            target_title=t.get("target_title", "Destino"),
            status=t.get("status", "COMPLETED"),
            total_videos=t.get("total_videos", 0),
            processed_videos=t.get("processed_videos", 0),
            estimated_mb=t.get("estimated_mb", 0.0),
            created_at=t.get("created_at", ""),
        )
        for t in raw_transfers
    ]

    raw_top = raw.get("top_channels", [])
    top_channels = [
        TopChannelTrafficItem(
            channel_id=tc.get("channel_id", 0),
            title=tc.get("title", ""),
            total_items=tc.get("total_items", 0),
            volume_gb=tc.get("volume_gb", 0.0),
        )
        for tc in raw_top
    ]

    active_syncs = raw.get("active_sync_bindings", 0)
    health = PipelineHealthMetrics(
        local_io_bypass_percent=100.0,
        avg_speed_sec_per_item=1.8,
        push_daemon_status="ONLINE" if active_syncs > 0 else "IDLE",
    )

    return AnalyticsSummaryResponse(
        total_items_migrated=raw.get("total_items_migrated", 0),
        total_bandwidth_saved_bytes=total_bytes,
        total_bandwidth_saved_gb=total_gb,
        duplicates_prevented=raw.get("duplicates_prevented", 0),
        total_jobs=raw.get("total_jobs", 0),
        jobs_by_status=raw.get("jobs_by_status", {}),
        active_sync_bindings=active_syncs,
        media_type_distribution=raw.get("media_type_distribution", {}),
        daily_volume=raw.get("daily_volume", []),
        efficiency_percent=raw.get("efficiency_percent", 99.8),
        recent_transfers=recent_transfers,
        top_channels=top_channels,
        pipeline_health=health,
    )


@router.get("/export")
async def export_analytics(
    format: str = Query("csv", pattern="^(csv|json)$"),
    repo: JobRepositoryPort = Depends(get_job_repository),
) -> Response:
    """Export executive throughput and migration analytics in CSV or JSON format."""
    overview = await get_analytics_overview(repo=repo)
    data = overview.model_dump()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if format == "csv":
        csv_content = ReportExporterService.generate_analytics_csv(data)
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="analytics_report_{timestamp}.csv"'
            },
        )
    else:  # json
        json_content = ReportExporterService.generate_analytics_json(data)
        return Response(
            content=json_content,
            media_type="application/json; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="analytics_report_{timestamp}.json"'
            },
        )

