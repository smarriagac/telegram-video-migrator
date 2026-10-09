from __future__ import annotations

import os
from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.application.broadcaster import broadcaster, EventBroadcaster
from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase
from backend.application.use_cases.get_dialogs_use_case import GetDialogsUseCase
from backend.application.use_cases.get_chat_messages_use_case import GetChatMessagesUseCase
from backend.application.use_cases.authenticate_user_use_case import AuthenticateUserUseCase
from backend.application.use_cases.save_telegram_credentials_use_case import SaveTelegramCredentialsUseCase
from backend.application.use_cases.get_active_telegram_credentials_use_case import GetActiveTelegramCredentialsUseCase
from backend.application.use_cases.list_users_use_case import ListUsersUseCase
from backend.application.use_cases.update_user_use_case import UpdateUserUseCase

from backend.domain.entities.user import User, Role
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.domain.ports.user_repository_port import UserRepositoryPort
from backend.domain.ports.telegram_account_repository_port import TelegramAccountRepositoryPort
from backend.domain.ports.encryption_port import EncryptionPort
from backend.domain.ports.token_service_port import TokenServicePort

from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository
from backend.infrastructure.persistence.postgres_repository import PostgresRepository
from backend.infrastructure.security.fernet_encryption_service import FernetEncryptionService
from backend.infrastructure.security.jwt_token_service import JwtTokenService
from backend.infrastructure.telegram.telegram_client_factory import (
    get_telegram_client,
    configure_telegram_client,
)
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter

_sqlite_repo: SQLiteJobRepository | None = None
_postgres_repo: PostgresRepository | None = None
_encryption_service: EncryptionPort | None = None
_token_service: TokenServicePort | None = None
_use_case_instance: CloneChannelVideosUseCase | None = None

security_scheme = HTTPBearer(auto_error=False)


async def get_job_repository() -> JobRepositoryPort:
    global _sqlite_repo
    if _sqlite_repo is None:
        db_path = os.getenv("MIGRATION_DB_PATH", "migration.db")
        _sqlite_repo = SQLiteJobRepository(db_path=db_path)
    return _sqlite_repo


async def get_postgres_repository() -> PostgresRepository:
    global _postgres_repo
    if _postgres_repo is None:
        _postgres_repo = PostgresRepository()
    return _postgres_repo


async def get_user_repository() -> UserRepositoryPort:
    return await get_postgres_repository()


async def get_account_repository() -> TelegramAccountRepositoryPort:
    return await get_postgres_repository()


def get_encryption_service() -> EncryptionPort:
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = FernetEncryptionService()
    return _encryption_service


def get_token_service() -> TokenServicePort:
    global _token_service
    if _token_service is None:
        _token_service = JwtTokenService()
    return _token_service


async def get_telegram_gateway() -> TelegramGatewayPort:
    try:
        acc_use_case = await get_active_credentials_use_case()
        creds = await acc_use_case.execute()
        if creds.api_id and creds.api_hash:
            client = configure_telegram_client(
                api_id=creds.api_id,
                api_hash=creds.api_hash,
                session_string=creds.session_string,
            )
            return TelethonAdapter(client=client)
    except Exception:
        pass
    client = get_telegram_client()
    return TelethonAdapter(client=client)


async def get_broadcaster() -> EventBroadcaster:
    return broadcaster


async def get_migration_use_case() -> CloneChannelVideosUseCase:
    global _use_case_instance
    if _use_case_instance is None:
        repo = await get_job_repository()
        gateway = await get_telegram_gateway()
        _use_case_instance = CloneChannelVideosUseCase(
            telegram_gateway=gateway,
            job_repository=repo,
        )
    return _use_case_instance


async def get_dialogs_use_case() -> GetDialogsUseCase:
    gateway = await get_telegram_gateway()
    return GetDialogsUseCase(telegram_gateway=gateway)


async def get_chat_messages_use_case() -> GetChatMessagesUseCase:
    gateway = await get_telegram_gateway()
    return GetChatMessagesUseCase(telegram_gateway=gateway)


async def get_authenticate_user_use_case() -> AuthenticateUserUseCase:
    user_repo = await get_user_repository()
    token_svc = get_token_service()
    return AuthenticateUserUseCase(user_repository=user_repo, token_service=token_svc)


async def get_save_credentials_use_case() -> SaveTelegramCredentialsUseCase:
    acc_repo = await get_account_repository()
    enc_svc = get_encryption_service()
    return SaveTelegramCredentialsUseCase(account_repository=acc_repo, encryption_service=enc_svc)


async def get_active_credentials_use_case() -> GetActiveTelegramCredentialsUseCase:
    acc_repo = await get_account_repository()
    enc_svc = get_encryption_service()
    return GetActiveTelegramCredentialsUseCase(account_repository=acc_repo, encryption_service=enc_svc)


async def get_list_users_use_case() -> ListUsersUseCase:
    user_repo = await get_user_repository()
    return ListUsersUseCase(user_repository=user_repo)


async def get_update_user_use_case() -> UpdateUserUseCase:
    user_repo = await get_user_repository()
    return UpdateUserUseCase(user_repository=user_repo)


# RBAC Security Dependencies
async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    user_repo: UserRepositoryPort = Depends(get_user_repository),
    token_svc: TokenServicePort = Depends(get_token_service),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticación requerida. Token no provisto.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = token_svc.decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await user_repo.get_by_id(int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo o no encontrado.",
        )
    return user


def require_roles(allowed_roles: list[Role]) -> Callable:
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso denegado. Se requiere uno de los roles: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker
