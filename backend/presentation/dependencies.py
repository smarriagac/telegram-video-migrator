from __future__ import annotations

import os
from backend.application.broadcaster import broadcaster, EventBroadcaster
from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository
from backend.infrastructure.telegram.telegram_client_factory import get_telegram_client
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter

_repo_instance: SQLiteJobRepository | None = None
_use_case_instance: CloneChannelVideosUseCase | None = None


async def get_job_repository() -> JobRepositoryPort:
    global _repo_instance
    if _repo_instance is None:
        db_path = os.getenv("MIGRATION_DB_PATH", "migration.db")
        _repo_instance = SQLiteJobRepository(db_path=db_path)
    return _repo_instance


async def get_telegram_gateway() -> TelegramGatewayPort:
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
