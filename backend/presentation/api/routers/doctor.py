from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.domain.entities.user import User, Role
from backend.application.services.health_doctor_service import (
    HealthDoctorService,
    get_health_doctor_service,
)
from backend.presentation.dependencies import (
    get_current_user,
    require_roles,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health/doctor", tags=["System Doctor & Readiness Probes"])


class RemediationRequest(BaseModel):
    action: str = Field(
        ...,
        description="Remediation action: clean_temp_storage, refresh_pool, reset_rate_governor, or test_db_latency",
    )


class SubsystemCheck(BaseModel):
    status: str
    error: str | None = None
    details: dict[str, Any] = {}


class DoctorReportResponse(BaseModel):
    overall_status: str
    timestamp: str
    checks: dict[str, Any]
    recommendations: list[str]


class RemediationResponse(BaseModel):
    remediated: bool
    action: str
    message: str
    files_deleted: int | None = None
    bytes_freed: int | None = None
    freed_mb: float | None = None
    clients_in_pool: int | None = None
    avg_latency_ms: float | None = None
    samples_ms: list[float] | None = None


def get_doctor_service() -> HealthDoctorService:
    return get_health_doctor_service()


@router.get("", response_model=DoctorReportResponse)
async def run_doctor_diagnostics(
    current_user: User = Depends(require_roles([Role.ADMIN])),
    doctor_service: HealthDoctorService = Depends(get_doctor_service),
) -> DoctorReportResponse:
    """Run full system diagnostic probe sweep across PostgreSQL, MTProto, FFmpeg, and Scratch Storage."""
    try:
        report = await doctor_service.diagnose_all()
        return DoctorReportResponse(**report)
    except Exception as e:
        logger.error(f"Error during doctor diagnostic probe sweep: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing doctor diagnostic probes: {str(e)}",
        )


@router.post("/remediate", response_model=RemediationResponse)
async def run_doctor_remediation(
    req: RemediationRequest,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    doctor_service: HealthDoctorService = Depends(get_doctor_service),
) -> RemediationResponse:
    """Execute operator-directed or automated self-healing remediation action."""
    try:
        outcome = await doctor_service.remediate(req.action)
        return RemediationResponse(**outcome)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Error during doctor remediation '{req.action}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Remediation action failed: {str(e)}",
        )
