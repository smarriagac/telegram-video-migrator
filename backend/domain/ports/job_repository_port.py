from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.entities.cloning_history import ChannelCloningHistory, ClonedContentItem
from backend.domain.entities.sync_binding import ChannelSyncBinding


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
    async def list_jobs(
        self,
        limit: int = 50,
        offset: int = 0,
        status: JobStatus | None = None,
    ) -> tuple[list[MigrationJob], int]:
        """List migration jobs ordered by creation time descending, with total count."""
        raise NotImplementedError

    @abstractmethod
    async def retry_failed_queue_items(self, job_id: str) -> int:
        """Reset failed queue items for a job back to PENDING so they can be reprocessed."""
        raise NotImplementedError

    @abstractmethod
    async def delete_job(self, job_id: str) -> bool:
        """Delete a migration job and its associated queue items."""
        raise NotImplementedError

    @abstractmethod
    async def reconcile_orphaned_jobs(self) -> int:
        """Transition any orphaned jobs in RUNNING state to PAUSED on server startup."""
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

    @abstractmethod
    async def add_queue_items(self, items: list[QueueItem]) -> None:
        """Batch persist queued units for a migration job."""
        raise NotImplementedError

    @abstractmethod
    async def get_queue_items(
        self, job_id: str, status: QueueItemStatus | None = None
    ) -> list[QueueItem]:
        """Fetch queue items for a job, optionally filtered by status."""
        raise NotImplementedError

    @abstractmethod
    async def get_next_pending_queue_item(self, job_id: str) -> QueueItem | None:
        """Retrieve the next pending item in queue ordered by source_message_id."""
        raise NotImplementedError

    @abstractmethod
    async def update_queue_item_status(
        self,
        job_id: str,
        source_msg_id: int,
        status: QueueItemStatus,
        target_msg_id: int | None = None,
        error_message: str | None = None,
    ) -> None:
        """Update individual queue item status and result."""
        raise NotImplementedError

    @abstractmethod
    async def get_queue_stats(self, job_id: str) -> dict[str, int]:
        """Retrieve aggregated queue counts (total, pending, in_progress, completed, failed, skipped)."""
        raise NotImplementedError

    @abstractmethod
    async def get_channel_cloning_history(self, channel_id: int) -> ChannelCloningHistory:
        """Retrieve audit history of all cloning jobs executed for a source channel."""
        raise NotImplementedError

    @abstractmethod
    async def get_cloned_content_for_channel(self, channel_id: int) -> list[ClonedContentItem]:
        """Retrieve list of all individual messages/content successfully cloned from this channel."""
        raise NotImplementedError

    async def get_source_item_for_target(
        self, target_channel_id: int, target_message_id: int
    ) -> tuple[int, int] | None:
        """Find source_channel_id and source_message_id for a cloned target message."""
        return None

    async def get_cloned_source_message_ids(
        self, source_channel_id: int, target_channel_id: int
    ) -> set[int]:
        """Retrieve set of source message IDs already cloned to the target channel."""
        return set()

    async def save_sync_binding(self, binding: ChannelSyncBinding) -> ChannelSyncBinding:
        """Persist or update an auto-sync channel binding."""
        return binding

    async def get_sync_binding(
        self, source_channel_id: int, target_channel_id: int
    ) -> ChannelSyncBinding | None:
        """Retrieve an auto-sync binding between two channels."""
        return None

    async def get_active_sync_bindings(self) -> list[ChannelSyncBinding]:
        """Retrieve all active real-time channel sync bindings."""
        return []

    async def list_sync_bindings(self) -> list[ChannelSyncBinding]:
        """List all auto-sync bindings regardless of status."""
        return []

    async def delete_sync_binding(
        self, source_channel_id: int, target_channel_id: int
    ) -> bool:
        """Delete an auto-sync binding."""
        return True

    async def is_media_fingerprint_duplicated(
        self, target_channel_id: int, fingerprint_hash: str
    ) -> bool:
        """Check if media with the same fingerprint was already cloned to this target channel."""
        return False

    async def record_media_fingerprint(
        self,
        target_channel_id: int,
        fingerprint_hash: str,
        source_channel_id: int | None = None,
        source_message_id: int | None = None,
        target_message_id: int | None = None,
        media_type: str = "video",
    ) -> None:
        """Record fingerprint of newly migrated media to prevent future duplicates."""
        pass
