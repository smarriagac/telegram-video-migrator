from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from backend.presentation.dependencies import get_observability_service
from backend.application.services.observability_service import ObservabilityService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Observability & Metrics"])


@router.get("/metrics")
async def get_prometheus_metrics(
    observability_svc: ObservabilityService = Depends(get_observability_service),
) -> Response:
    """Standard Prometheus / OpenMetrics scrape endpoint."""
    metrics = await observability_svc.collect_metrics()
    formatted = observability_svc.format_prometheus(metrics)
    return Response(
        content=formatted,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/api/system/metrics")
async def get_system_metrics_json(
    observability_svc: ObservabilityService = Depends(get_observability_service),
) -> dict[str, Any]:
    """Retrieve system observability metrics in structured JSON format."""
    return await observability_svc.collect_metrics()


class AnomalyCheckResponse(BaseModel):
    anomalies: list[dict[str, Any]]
    count: int
    has_critical: bool


@router.post("/api/system/metrics/anomalies/evaluate", response_model=AnomalyCheckResponse)
async def evaluate_anomalies(
    dispatch: bool = True,
    observability_svc: ObservabilityService = Depends(get_observability_service),
) -> AnomalyCheckResponse:
    """Perform real-time anomaly evaluation against MTProto pool and job queues."""
    anomalies = await observability_svc.evaluate_anomalies(dispatch_alerts=dispatch)
    has_critical = any(a.get("severity") in ("CRITICAL", "ERROR") for a in anomalies)
    return AnomalyCheckResponse(
        anomalies=anomalies,
        count=len(anomalies),
        has_critical=has_critical,
    )
