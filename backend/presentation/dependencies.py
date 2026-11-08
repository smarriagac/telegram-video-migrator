from __future__ import annotations

import logging
import os
from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

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
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.domain.ports.encryption_port import EncryptionPort
from backend.domain.ports.token_service_port import TokenServicePort

from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository
from backend.infrastructure.persistence.postgres_job_repository import PostgresJobRepository
from backend.infrastructure.persistence.postgres_repository import PostgresRepository
from backend.infrastructure.security.fernet_encryption_service import FernetEncryptionService
from backend.infrastructure.security.jwt_token_service import JwtTokenService
from backend.infrastructure.telegram.telegram_client_factory import (
    get_telegram_client,
    configure_telegram_client,
)
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter

from backend.infrastructure.telegram.telegram_client_pool import TelegramClientPool

_job_repo: JobRepositoryPort | None = None
_postgres_repo: PostgresRepository | None = None
_encryption_service: EncryptionPort | None = None
_token_service: TokenServicePort | None = None
_use_case_instance: CloneChannelVideosUseCase | None = None
_client_pool: TelegramClientPool | None = None
_live_sync_service: Any = None

security_scheme = HTTPBearer(auto_error=False)


async def get_job_repository() -> JobRepositoryPort:
    global _job_repo
    if _job_repo is None:
        _job_repo = PostgresJobRepository()
    return _job_repo


async def get_postgres_repository() -> PostgresRepository:
    global _postgres_repo
    if _postgres_repo is None:
        _postgres_repo = PostgresRepository()
    return _postgres_repo


async def get_user_repository() -> UserRepositoryPort:
    return await get_postgres_repository()


async def get_account_repository() -> TelegramAccountRepositoryPort:
    return await get_postgres_repository()


async def get_audit_repository() -> AuditRepositoryPort:
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


async def get_telegram_client_pool() -> TelegramClientPool:
    global _client_pool
    if _client_pool is None:
        _client_pool = TelegramClientPool()
        await refresh_telegram_client_pool()
    return _client_pool


async def refresh_telegram_client_pool() -> TelegramClientPool:
    global _client_pool
    if _client_pool is None:
        _client_pool = TelegramClientPool()

    try:
        repo = await get_postgres_repository()
        enc_svc = get_encryption_service()
        accounts = await repo.list_active_accounts()
        from telethon.sessions import StringSession
        from telethon import TelegramClient

        first = True
        for acc in accounts:
            try:
                api_id = int(enc_svc.decrypt(acc.api_id_encrypted))
                api_hash = enc_svc.decrypt(acc.api_hash_encrypted)
                session_str = enc_svc.decrypt(acc.session_string_encrypted) if acc.session_string_encrypted else None
                if api_id and api_hash and session_str:
                    try:
                        session_obj = StringSession(session_str)
                    except Exception:
                        session_obj = StringSession()
                    cl = TelegramClient(session_obj, api_id, api_hash)
                    _client_pool.register_client(
                        account_id=acc.id or 1,
                        account_name=acc.name,
                        client=cl,
                        tenant_id=acc.tenant_id,
                        is_default=first,
                    )
                    first = False
            except Exception as e:
                logger.warning(f"Failed to register client for account #{acc.id} ({acc.name}): {e}")
    except Exception as ex:
        logger.warning(f"Error refreshing telegram client pool: {ex}")

    if not _client_pool.list_clients():
        default_client = get_telegram_client()
        _client_pool.register_client(
            account_id=1,
            account_name="Cuenta Principal",
            client=default_client,
            is_default=True,
        )

    return _client_pool


async def get_telegram_gateway(tenant_id: str | None = None) -> TelegramGatewayPort:
    pool = await get_telegram_client_pool()
    default_client = pool.get_client(tenant_id=tenant_id) or pool.get_client(None)
    return TelethonAdapter(client=default_client, pool=pool, tenant_id=tenant_id)


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


async def get_live_sync_service():
    global _live_sync_service
    if _live_sync_service is None:
        from backend.application.services.live_sync_service import LiveSyncService

        repo = await get_job_repository()
        pool = await get_telegram_client_pool()
        use_case = await get_migration_use_case()
        bc = await get_broadcaster()
        alerting = await get_alerting_service()
        _live_sync_service = LiveSyncService(
            job_repository=repo,
            client_pool=pool,
            migration_use_case=use_case,
            broadcaster=bc,
            alerting_service=alerting,
        )
    return _live_sync_service


_video_processing_service = None

async def get_video_processing_service():
    global _video_processing_service
    if _video_processing_service is None:
        from backend.application.services.video_processing_service import VideoProcessingService
        pg_repo = await get_postgres_repository()
        _video_processing_service = VideoProcessingService(
            pg_repo=pg_repo,
            gateway_provider=get_telegram_gateway,
        )
    return _video_processing_service


_job_scheduler_instance = None

async def get_job_scheduler_service():
    global _job_scheduler_instance
    if _job_scheduler_instance is None:
        from backend.application.services.job_scheduler_service import JobSchedulerService
        repo = await get_job_repository()
        use_case = await get_migration_use_case()
        bc = await get_broadcaster()
        _job_scheduler_instance = JobSchedulerService(
            job_repo=repo,
            use_case=use_case,
            broadcaster=bc,
            poll_interval=10.0,
        )
    return _job_scheduler_instance


_alerting_service_instance = None

async def get_alerting_service():
    global _alerting_service_instance
    if _alerting_service_instance is None:
        from backend.application.services.alerting_service import AlertingService
        gateway = await get_telegram_gateway()
        pg_repo = await get_postgres_repository()
        dispatcher = await get_webhook_dispatcher()
        _alerting_service_instance = AlertingService(
            gateway=gateway,
            pg_repo=pg_repo,
            webhook_dispatcher=dispatcher,
        )
    return _alerting_service_instance


_broadcast_scheduler_instance = None

async def get_broadcast_scheduler_service():
    global _broadcast_scheduler_instance
    if _broadcast_scheduler_instance is None:
        from backend.application.services.broadcast_scheduler_service import BroadcastSchedulerService
        repo = await get_job_repository()
        gateway = await get_telegram_gateway()
        bc = await get_broadcaster()
        audit_repo = await get_audit_repository()
        alerting = await get_alerting_service()
        _broadcast_scheduler_instance = BroadcastSchedulerService(
            job_repo=repo,
            telegram_gateway=gateway,
            broadcaster=bc,
            audit_repo=audit_repo,
            alerting_service=alerting,
            poll_interval=10.0,
        )
    return _broadcast_scheduler_instance


_crash_recovery_service_instance = None


async def get_crash_recovery_service():
    global _crash_recovery_service_instance
    if _crash_recovery_service_instance is None:
        from backend.application.services.crash_recovery_service import CrashRecoveryService
        repo = await get_job_repository()
        alerting = await get_alerting_service()
        _crash_recovery_service_instance = CrashRecoveryService(
            job_repo=repo,
            alerting_service=alerting,
        )
    return _crash_recovery_service_instance


_pre_flight_service_instance = None


async def get_pre_flight_service():
    global _pre_flight_service_instance
    if _pre_flight_service_instance is None:
        from backend.application.services.pre_flight_service import PreFlightService
        repo = await get_job_repository()
        gateway = await get_telegram_gateway()
        pool = await get_telegram_client_pool()
        _pre_flight_service_instance = PreFlightService(
            job_repo=repo,
            gateway=gateway,
            client_pool=pool,
        )
    return _pre_flight_service_instance


_disaster_recovery_service_instance = None


async def get_disaster_recovery_service():
    global _disaster_recovery_service_instance
    if _disaster_recovery_service_instance is None:
        from backend.application.services.disaster_recovery_service import DisasterRecoveryService
        job_repo = await get_job_repository()
        pg_repo = await get_postgres_repository()
        alerting = await get_alerting_service()
        _disaster_recovery_service_instance = DisasterRecoveryService(
            job_repo=job_repo,
            postgres_repo=pg_repo,
            alerting_service=alerting,
        )
    return _disaster_recovery_service_instance


_template_repository_instance = None


async def get_template_repository():
    global _template_repository_instance
    if _template_repository_instance is None:
        from backend.infrastructure.persistence.postgres_template_repository import PostgresTemplateRepository
        _template_repository_instance = PostgresTemplateRepository()
        await _template_repository_instance.initialize_schema()
    return _template_repository_instance


_template_service_instance = None


def get_template_service():
    global _template_service_instance
    if _template_service_instance is None:
        from backend.application.services.template_service import TemplateService
        _template_service_instance = TemplateService()
    return _template_service_instance


_webhook_repository_instance = None


async def get_webhook_repository():
    global _webhook_repository_instance
    if _webhook_repository_instance is None:
        from backend.infrastructure.persistence.postgres_webhook_repository import PostgresWebhookRepository
        _webhook_repository_instance = PostgresWebhookRepository()
        await _webhook_repository_instance.initialize_schema()
    return _webhook_repository_instance


_webhook_dispatcher_instance = None


async def get_webhook_dispatcher():
    global _webhook_dispatcher_instance
    if _webhook_dispatcher_instance is None:
        from backend.application.services.webhook_dispatcher_service import WebhookDispatcherService
        repo = await get_webhook_repository()
        _webhook_dispatcher_instance = WebhookDispatcherService(repository=repo)
    return _webhook_dispatcher_instance






