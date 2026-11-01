from __future__ import annotations

import asyncio
import logging
from typing import Any
from telethon import events, TelegramClient

from backend.application.broadcaster import EventBroadcaster
from backend.application.use_cases.clone_channel_videos_use_case import CloneChannelVideosUseCase
from backend.domain.entities.migration_job import JobStatus, MigrationJob
from backend.domain.entities.queue_item import QueueItem, QueueItemStatus
from backend.domain.entities.sync_binding import ChannelSyncBinding
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.infrastructure.telegram.telegram_client_pool import TelegramClientPool

logger = logging.getLogger(__name__)


class LiveSyncService:
    """Orchestrates real-time channel synchronization using MTProto push events and a persistent queue."""

    def __init__(
        self,
        job_repository: JobRepositoryPort,
        client_pool: TelegramClientPool,
        migration_use_case: CloneChannelVideosUseCase,
        broadcaster: EventBroadcaster,
    ) -> None:
        self.repo = job_repository
        self.pool = client_pool
        self.use_case = migration_use_case
        self.broadcaster = broadcaster

        self._bindings: dict[int, list[ChannelSyncBinding]] = {}
        self._queue: asyncio.Queue[tuple[ChannelSyncBinding, int, str, str]] = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None
        self._attached_clients: set[int] = set()
        self._is_running = False

    async def start(self) -> None:
        """Start consumer worker and attach MTProto push event handlers."""
        if self._is_running:
            return
        self._is_running = True

        await self.reload_bindings()

        # Start sequential queue consumer
        self._worker_task = asyncio.create_task(self._process_queue_loop())
        logger.info("LiveSyncService consumer loop started.")

        # Attach MTProto event listeners to active pool clients
        self.attach_client_listeners()

    async def stop(self) -> None:
        """Gracefully stop worker task."""
        self._is_running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
        logger.info("LiveSyncService stopped.")

    async def reload_bindings(self) -> None:
        """Reload active bindings from repository into memory."""
        active_bindings = await self.repo.get_active_sync_bindings()
        new_map: dict[int, list[ChannelSyncBinding]] = {}
        for b in active_bindings:
            new_map.setdefault(b.source_channel_id, []).append(b)
        self._bindings = new_map
        logger.info(f"LiveSyncService loaded {len(active_bindings)} active sync bindings for {len(new_map)} source channels.")

    def attach_client_listeners(self) -> None:
        """Register events.NewMessage handler on all connected clients in pool."""
        clients = self.pool.list_clients()
        for acc_id, acc_name, client in clients:
            if acc_id not in self._attached_clients:
                self._attach_listener(client, acc_id)
                self._attached_clients.add(acc_id)
                logger.info(f"LiveSync: Attached NewMessage listener to account #{acc_id} ({acc_name}).")

    def _attach_listener(self, client: TelegramClient, account_id: int) -> None:
        """Attach Telethon event handler for incoming channel messages."""

        @client.on(events.NewMessage)
        async def _new_message_handler(event: Any) -> None:
            await self._handle_incoming_event(event, account_id)

    async def _handle_incoming_event(self, event: Any, account_id: int) -> None:
        """Filter incoming message by active sync bindings and enqueue valid posts."""
        try:
            chat_id = event.chat_id
            if not chat_id:
                return

            bindings = self._bindings.get(chat_id)
            if not bindings:
                # Also try matching absolute/converted ID if applicable
                alt_id = -int(f"100{abs(chat_id)}") if abs(chat_id) < 10000000000 else None
                if alt_id:
                    bindings = self._bindings.get(alt_id)

            if not bindings:
                return

            msg = getattr(event, "message", None)
            if not msg:
                return

            msg_id = getattr(msg, "id", None)
            if not msg_id:
                return

            media_type = "text"
            if getattr(msg, "video", None):
                media_type = "video"
            elif getattr(msg, "photo", None):
                media_type = "photo"
            elif getattr(msg, "document", None):
                media_type = "document"

            caption = getattr(msg, "message", "") or ""

            for binding in bindings:
                if not binding.is_active:
                    continue

                # Idempotency check: verify not already cloned
                cloned_ids = await self.repo.get_cloned_source_message_ids(
                    binding.source_channel_id, binding.target_channel_id
                )
                if msg_id in cloned_ids:
                    logger.debug(
                        f"LiveSync: Message {msg_id} already cloned for binding {binding.source_channel_id} -> {binding.target_channel_id}."
                    )
                    continue

                # Enqueue message for persistent queued processing
                await self._queue.put((binding, msg_id, media_type, caption))
                logger.info(
                    f"LiveSync: Enqueued message #{msg_id} ({media_type}) for target {binding.target_channel_id}"
                )
        except Exception as e:
            logger.error(f"LiveSync incoming event error: {e}", exc_info=True)

    async def _process_queue_loop(self) -> None:
        """Sequential consumer worker processing enqueued live messages with rate limiting."""
        while self._is_running:
            try:
                item = await self._queue.get()
            except asyncio.CancelledError:
                break

            binding, msg_id, media_type, caption = item
            try:
                # Re-check idempotency right before execution
                cloned_ids = await self.repo.get_cloned_source_message_ids(
                    binding.source_channel_id, binding.target_channel_id
                )
                if msg_id in cloned_ids:
                    continue

                job_id = f"sync_{abs(binding.source_channel_id)}_{abs(binding.target_channel_id)}_{msg_id}"
                existing_job = await self.repo.get_job(job_id)

                if not existing_job:
                    job = MigrationJob(
                        job_id=job_id,
                        source_id=binding.source_channel_id,
                        target_id=binding.target_channel_id,
                        status=JobStatus.PENDING,
                        total_videos=1,
                        processed_videos=0,
                        is_full_migration=False,
                        source_title=binding.source_channel_title,
                        target_title=binding.target_channel_title,
                        source_account_id=binding.source_account_id,
                        target_account_id=binding.target_account_id,
                    )
                    await self.repo.create_job(job)

                    queue_item = QueueItem(
                        job_id=job_id,
                        source_message_id=msg_id,
                        status=QueueItemStatus.PENDING,
                        media_type=media_type,
                        caption=caption,
                    )
                    await self.repo.add_queue_items([queue_item])

                # Execute migration use case for this job
                async def _on_progress(progress: dict[str, Any]) -> None:
                    await self.broadcaster.broadcast("migration_progress", progress)

                await self.use_case.execute(job_id, on_progress=_on_progress)

                # Update binding state
                binding.last_synced_message_id = max(binding.last_synced_message_id, msg_id)
                await self.repo.save_sync_binding(binding)

                await self.broadcaster.broadcast(
                    "sync_event",
                    {
                        "type": "message_synced",
                        "source_channel_id": binding.source_channel_id,
                        "target_channel_id": binding.target_channel_id,
                        "source_message_id": msg_id,
                        "media_type": media_type,
                    },
                )
                logger.info(
                    f"LiveSync: Successfully synced message #{msg_id} from {binding.source_channel_id} to {binding.target_channel_id}."
                )
            except Exception as err:
                logger.error(f"LiveSync error processing message #{msg_id}: {err}", exc_info=True)
            finally:
                self._queue.task_done()

    async def set_binding(
        self,
        source_channel_id: int,
        target_channel_id: int,
        is_active: bool,
        source_title: str | None = None,
        target_title: str | None = None,
        source_account_id: int | None = None,
        target_account_id: int | None = None,
    ) -> ChannelSyncBinding:
        """Create or update a channel auto-sync binding."""
        existing = await self.repo.get_sync_binding(source_channel_id, target_channel_id)
        if existing:
            existing.is_active = is_active
            if source_title:
                existing.source_channel_title = source_title
            if target_title:
                existing.target_channel_title = target_title
            if source_account_id is not None:
                existing.source_account_id = source_account_id
            if target_account_id is not None:
                existing.target_account_id = target_account_id
            saved = await self.repo.save_sync_binding(existing)
        else:
            new_binding = ChannelSyncBinding(
                source_channel_id=source_channel_id,
                target_channel_id=target_channel_id,
                source_channel_title=source_title,
                target_channel_title=target_title,
                source_account_id=source_account_id,
                target_account_id=target_account_id,
                is_active=is_active,
            )
            saved = await self.repo.save_sync_binding(new_binding)

        await self.reload_bindings()
        self.attach_client_listeners()
        return saved
