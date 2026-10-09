from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.domain.entities.user import User, Role
from backend.domain.entities.telegram_account import TelegramAccount
from backend.domain.ports.telegram_account_repository_port import TelegramAccountRepositoryPort
from backend.application.use_cases.save_telegram_credentials_use_case import SaveTelegramCredentialsUseCase
from backend.presentation.dependencies import (
    get_save_credentials_use_case,
    get_account_repository,
    require_roles,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings/credentials", tags=["Settings & Credentials"])


class TelegramCredentialsRequest(BaseModel):
    name: str = "Cuenta Principal"
    phone: str | None = None
    api_id: str
    api_hash: str
    session_string: str | None = None


class TelegramAccountResponse(BaseModel):
    id: int
    name: str
    phone: str | None
    api_id_masked: str
    api_hash_masked: str
    has_session: bool
    is_active: bool
    created_at: str | None = None


def mask_credential(value: str) -> str:
    if not value or len(value) < 4:
        return "****"
    return f"{value[:3]}****{value[-2:]}"


@router.post("", response_model=TelegramAccountResponse, status_code=status.HTTP_201_CREATED)
async def save_credentials(
    req: TelegramCredentialsRequest,
    use_case: SaveTelegramCredentialsUseCase = Depends(get_save_credentials_use_case),
    _: User = Depends(require_roles([Role.ADMIN])),
) -> TelegramAccountResponse:
    """Admin-only: Encrypts and persists Telegram MTProto API credentials in PostgreSQL."""
    try:
        saved = await use_case.execute(
            name=req.name,
            api_id=req.api_id,
            api_hash=req.api_hash,
            phone=req.phone,
            session_string=req.session_string,
        )
        return TelegramAccountResponse(
            id=saved.id or 1,
            name=saved.name,
            phone=saved.phone,
            api_id_masked=mask_credential(req.api_id),
            api_hash_masked="********************************",
            has_session=bool(req.session_string),
            is_active=saved.is_active,
            created_at=saved.created_at,
        )
    except Exception as e:
        logger.error(f"Error saving telegram credentials: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error cifrando y guardando las credenciales.",
        )


@router.get("", response_model=list[TelegramAccountResponse])
async def list_credentials(
    acc_repo: TelegramAccountRepositoryPort = Depends(get_account_repository),
    _: User = Depends(require_roles([Role.ADMIN])),
) -> list[TelegramAccountResponse]:
    """Admin-only: Retrieves configured accounts with strictly masked credentials."""
    accounts = await acc_repo.list_accounts()
    return [
        TelegramAccountResponse(
            id=acc.id or 1,
            name=acc.name,
            phone=acc.phone,
            api_id_masked="Cifrado en reposo (AES-256)",
            api_hash_masked="********************************",
            has_session=bool(acc.session_string_encrypted),
            is_active=acc.is_active,
            created_at=acc.created_at,
        )
        for acc in accounts
    ]
