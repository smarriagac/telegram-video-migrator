from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.domain.entities.user import User, Role
from backend.application.services.disaster_recovery_service import DisasterRecoveryService
from backend.presentation.dependencies import (
    get_current_user,
    require_roles,
    get_disaster_recovery_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/backups", tags=["Disaster Recovery & Automated Backups"])


class CreateBackupRequest(BaseModel):
    trigger: str = Field(default="MANUAL", description="Trigger source: MANUAL, SCHEDULED, or SYSTEM")
    retention_limit: int = Field(default=7, ge=1, le=50, description="Rolling snapshot retention limit")


class BackupMetadataResponse(BaseModel):
    snapshot_id: str
    filename: str
    created_at: str
    trigger: str
    size_bytes: int
    table_counts: dict[str, int] = {}
    total_records: int = 0
    sha256: str = ""


class BackupListResponse(BaseModel):
    snapshots: list[BackupMetadataResponse]
    total_count: int
    total_size_bytes: int
    retention_limit: int = 7


@router.get("", response_model=BackupListResponse)
async def list_backups(
    current_user: User = Depends(require_roles([Role.ADMIN])),
    recovery_service: DisasterRecoveryService = Depends(get_disaster_recovery_service),
) -> dict[str, Any]:
    """Lists all available disaster recovery backups, storage usage, and active retention policy."""
    snapshots = await recovery_service.list_snapshots()
    total_size = sum(s.get("size_bytes", 0) for s in snapshots)

    return {
        "snapshots": snapshots,
        "total_count": len(snapshots),
        "total_size_bytes": total_size,
        "retention_limit": 7,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_backup(
    payload: CreateBackupRequest = CreateBackupRequest(),
    current_user: User = Depends(require_roles([Role.ADMIN])),
    recovery_service: DisasterRecoveryService = Depends(get_disaster_recovery_service),
) -> dict[str, Any]:
    """Triggers an immediate database and state snapshot, applies retention pruning, and returns manifest."""
    try:
        snapshot = await recovery_service.create_snapshot(
            trigger=payload.trigger,
            retention_limit=payload.retention_limit,
        )
        return snapshot
    except Exception as e:
        logger.error(f"Failed to create disaster recovery snapshot: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar la copia de seguridad: {str(e)}",
        )


@router.get("/{snapshot_id}/download")
async def download_backup(
    snapshot_id: str,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    recovery_service: DisasterRecoveryService = Depends(get_disaster_recovery_service),
) -> FileResponse:
    """Streams the compressed (.tar.gz) disaster recovery archive for secure offsite storage."""
    try:
        path = await recovery_service.get_snapshot_path(snapshot_id)
        if not path or not path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Copia de seguridad '{snapshot_id}' no encontrada.",
            )

        return FileResponse(
            path=str(path),
            media_type="application/gzip",
            filename=path.name,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to stream backup archive: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{snapshot_id}/verify")
async def verify_backup(
    snapshot_id: str,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    recovery_service: DisasterRecoveryService = Depends(get_disaster_recovery_service),
) -> dict[str, Any]:
    """Executes a dry-run integrity verification on the archive without altering live state."""
    try:
        result = await recovery_service.verify_snapshot(snapshot_id)
        if not result.get("valid"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.get("error", "Archivo de respaldo inválido o corrupto."),
            )
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to verify snapshot: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{snapshot_id}")
async def delete_backup(
    snapshot_id: str,
    current_user: User = Depends(require_roles([Role.ADMIN])),
    recovery_service: DisasterRecoveryService = Depends(get_disaster_recovery_service),
) -> dict[str, Any]:
    """Purges a specific disaster recovery archive from disk."""
    try:
        deleted = await recovery_service.delete_snapshot(snapshot_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Copia de seguridad '{snapshot_id}' no encontrada.",
            )
        return {"success": True, "deleted_snapshot_id": snapshot_id}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete backup archive: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
