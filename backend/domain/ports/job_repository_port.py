from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.migration_job import JobStatus, MigrationJob


class JobRepositoryPort(ABC):
    """Port defining migration job persistence operations."""

    @abstractmethod
    async def create_job(self, job: MigrationJob) -> None:
        """Persist a new migration job record."""
        raise NotImplementedError

    @abstractmethod
    async def update_job_progress(
        self, job_id: str, processed_count: int, last_msg_id: int
    ) -> None:
        """Update processed video count and last processed source message ID."""
        raise NotImplementedError

    @abstractmethod
    async def set_job_status(self, job_id: str, status: JobStatus) -> None:
        """Update status of a migration job."""
        raise NotImplementedError

    @abstractmethod
    async def get_job(self, job_id: str) -> MigrationJob | None:
        """Retrieve a migration job by ID."""
        raise NotImplementedError

    @abstractmethod
    async def record_migrated_item(
        self, job_id: str, source_msg_id: int, target_msg_id: int
    ) -> None:
        """Record an individual migrated video item for idempotency tracking."""
        raise NotImplementedError

    @abstractmethod
    async def is_item_migrated(self, job_id: str, source_msg_id: int) -> bool:
        """Check whether a specific source video message has already been migrated."""
        raise NotImplementedError
