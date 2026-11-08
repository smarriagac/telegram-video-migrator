from __future__ import annotations

import asyncio
from collections import OrderedDict
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


class MessageDedupCache:
    """Bounded in-memory LRU cache to check cloned message IDs in O(1) without DB trips."""

    def __init__(self, max_size_per_binding: int = 5000) -> None:
        self.max_size = max_size_per_binding
        self._cache: dict[tuple[int, int], OrderedDict[int, None]] = {}

    def is_cloned(self, source_id: int, target_id: int, msg_id: int) -> bool:
        key = (source_id, target_id)
        bucket = self._cache.get(key)
        if bucket is not None and msg_id in bucket:
            bucket.move_to_end(msg_id)
            return True
        return False

    def mark_cloned(self, source_id: int, target_id: int, msg_id: int) -> None:
        key = (source_id, target_id)
        if key not in self._cache:
            self._cache[key] = OrderedDict()
        bucket = self._cache[key]
        bucket[msg_id] = None
        bucket.move_to_end(msg_id)
        if len(bucket) > self.max_size:
            bucket.popitem(last=False)

    def populate(self, source_id: int, target_id: int, ids: list[int] | set[int]) -> None:
        key = (source_id, target_id)
        if key not in self._cache:
            self._cache[key] = OrderedDict()
        bucket = self._cache[key]
        for mid in sorted(ids)[-self.max_size:]:
            bucket[mid] = None
            if len(bucket) > self.max_size:
                bucket.popitem(last=False)

    def is_initialized(self, source_id: int, target_id: int) -> bool:
        return (source_id, target_id) in self._cache

    def invalidate(self, source_id: int, target_id: int) -> None:
        self._cache.pop((source_id, target_id), None)


class LiveSyncService:
    """Orchestrates real-time channel synchronization using MTProto push events and a persistent queue."""

    def __init__(
        self,
        job_repository: JobRepositoryPort,
        client_pool: TelegramClientPool,
        migration_use_case: CloneChannelVideosUseCase,
        broadcaster: EventBroadcaster,
        alerting_service: Any | None = None,
    ) -> None:
        self.repo = job_repository
        self.pool = client_pool
        self.use_case = migration_use_case
        self.broadcaster = broadcaster
        self.alerting_service = alerting_service
        self.dedup_cache = MessageDedupCache()

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

        # Catch up any messages missed while offline for active bindings
        for bindings in self._bindings.values():
            for b in bindings:
                asyncio.create_task(self.catch_up_delta(b))

    async def is_message_already_cloned(
        self, source_channel_id: int, target_channel_id: int, message_id: int
    ) -> bool:
        """Fast O(1) in-memory check with lazy one-time warm-up from repository."""
        if not self.dedup_cache.is_initialized(source_channel_id, target_channel_id):
            cloned_ids = await self.repo.get_cloned_source_message_ids(
                source_channel_id, target_channel_id
            )
            self.dedup_cache.populate(source_channel_id, target_channel_id, cloned_ids)

        return self.dedup_cache.is_cloned(source_channel_id, target_channel_id, message_id)

    async def catch_up_delta(self, binding: ChannelSyncBinding) -> int:
        """Scan source channel for any messages newer than last sync or missing from target and enqueue them."""
        try:
            cloned_ids = await self.repo.get_cloned_source_message_ids(
                binding.source_channel_id, binding.target_channel_id
            )
            self.dedup_cache.populate(
                binding.source_channel_id, binding.target_channel_id, cloned_ids
            )
            max_cloned = max(cloned_ids) if cloned_ids else 0

            client = self.pool.get_client(binding.source_account_id)
            if not client:
                clients = self.pool.list_clients()
                client = clients[0][2] if clients else None
            if not client:
                return 0

            if not client.is_connected():
                await client.connect()

            source_entity = await client.get_input_entity(binding.source_channel_id)
            messages = await client.get_messages(source_entity, limit=50, min_id=max_cloned)
            enqueued = 0
            for msg in reversed(messages):
                if not msg or not msg.id:
                    continue
                if msg.id in cloned_ids:
                    continue

                media_type = "text"
                if getattr(msg, "video", None):
                    media_type = "video"
                elif getattr(msg, "photo", None):
                    media_type = "photo"
                elif getattr(msg, "document", None):
                    doc = msg.document
                    is_video = getattr(doc, "mime_type", "").startswith("video/")
                    for attr in getattr(doc, "attributes", []):
                        if hasattr(attr, "duration"):
                            is_video = True
                            break
                    media_type = "video" if is_video else "document"

                caption = getattr(msg, "message", "") or ""
                await self._queue.put((binding, msg.id, media_type, caption))
                enqueued += 1

            if enqueued > 0:
                logger.info(
                    f"LiveSync: Caught up and enqueued {enqueued} un-synced messages for {binding.source_channel_id} -> {binding.target_channel_id}"
                )
            return enqueued
        except Exception as e:
            err_str = str(e).lower()
            if (
                "channelprivate" in err_str
                or "userbannedinchannel" in err_str
                or "not accessible" in err_str
                or "could not find the input entity" in err_str
            ):
                logger.error(
                    f"LiveSync: Access revoked for {binding.source_channel_id} -> {binding.target_channel_id}: {e}. Marking ACCESS_REVOKED."
                )
                binding.status = "ACCESS_REVOKED"
                binding.is_active = False
                binding.last_error = "Acceso revocado: La cuenta fue expulsada de este grupo en Telegram o el canal es privado."
                try:
                    await self.repo.save_sync_binding(binding)
                    await self.reload_bindings()
                except Exception as save_err:
                    logger.warning(f"Could not persist revoked binding status: {save_err}")

                if self.alerting_service and hasattr(self.alerting_service, "notify_channel_eviction"):
                    try:
                        asyncio.create_task(
                            self.alerting_service.notify_channel_eviction(
                                source_title=binding.source_channel_title,
                                source_channel_id=binding.source_channel_id,
                                account_id=binding.source_account_id,
                                error_details=str(e),
                            )
                        )
                    except Exception as ae:
                        logger.debug(f"LiveSync: Alerting suppressed: {ae}")
            else:
                logger.warning(
                    f"LiveSync: Catch-up delta failed for {binding.source_channel_id} -> {binding.target_channel_id}: {e}"
                )
            return 0

    async def verify_binding_access(self, source_channel_id: int, target_channel_id: int) -> dict[str, Any]:
        """Check if source channel is currently accessible via Telegram client."""
        binding = await self.repo.get_sync_binding(source_channel_id, target_channel_id)
        if not binding:
            return {"status": "NOT_FOUND", "message": "Vinculación no encontrada."}

        client = self.pool.get_client(binding.source_account_id)
        if not client:
            clients = self.pool.list_clients()
            client = clients[0][2] if clients else None
        if not client:
            return {"status": "ERROR", "message": "No hay clientes Telegram conectados en el pool."}

        if not client.is_connected():
            await client.connect()

        try:
            source_entity = await client.get_input_entity(binding.source_channel_id)
            await client.get_messages(source_entity, limit=1)
            binding.status = "ACTIVE" if binding.is_active else "PAUSED"
            binding.last_error = None
            await self.repo.save_sync_binding(binding)
            await self.reload_bindings()
            return {"status": "HEALTHY", "message": "Acceso verificado correctamente en Telegram."}
        except Exception as e:
            err_str = str(e).lower()
            if (
                "channelprivate" in err_str
                or "userbannedinchannel" in err_str
                or "not accessible" in err_str
                or "could not find the input entity" in err_str
            ):
                binding.status = "ACCESS_REVOKED"
                binding.is_active = False
                binding.last_error = "Acceso revocado: Fuiste expulsado de este grupo en Telegram."
                await self.repo.save_sync_binding(binding)
                await self.reload_bindings()

                if self.alerting_service and hasattr(self.alerting_service, "notify_channel_eviction"):
                    try:
                        asyncio.create_task(
                            self.alerting_service.notify_channel_eviction(
                                source_title=binding.source_channel_title,
                                source_channel_id=binding.source_channel_id,
                                account_id=binding.source_account_id,
                                error_details=str(e),
                            )
                        )
                    except Exception as ae:
                        logger.debug(f"LiveSync: Alerting suppressed: {ae}")

                return {"status": "ACCESS_REVOKED", "message": binding.last_error}

            return {"status": "ERROR", "message": str(e)}

    async def switch_binding_account(
        self,
        source_channel_id: int,
        target_channel_id: int,
        new_account_id: int,
    ) -> ChannelSyncBinding:
        """Switch the Telegram account assigned to source extraction on a sync binding, verifying accessibility."""
        binding = await self.repo.get_sync_binding(source_channel_id, target_channel_id)
        if not binding:
            raise ValueError(f"Vinculación {source_channel_id} -> {target_channel_id} no encontrada.")

        client = self.pool.get_client(new_account_id)
        if not client:
            raise ValueError(f"No existe un cliente activo para la cuenta #{new_account_id} en el pool de Telegram.")

        if not client.is_connected():
            await client.connect()

        try:
            source_entity = await client.get_input_entity(source_channel_id)
            await client.get_messages(source_entity, limit=1)
        except Exception as e:
            logger.warning(
                f"LiveSync: Cuenta #{new_account_id} no tiene acceso a {source_channel_id}: {e}"
            )
            raise PermissionError(
                f"La cuenta #{new_account_id} no tiene acceso o fue expulsada de este canal/grupo ({e})."
            )

        binding.source_account_id = new_account_id
        binding.status = "ACTIVE"
        binding.is_active = True
        binding.last_error = None
        saved = await self.repo.save_sync_binding(binding)
        await self.reload_bindings()
        self.attach_client_listeners()

        asyncio.create_task(self.catch_up_delta(saved))
        logger.info(
            f"LiveSync: Successfully switched source extraction for {source_channel_id} -> {target_channel_id} to account #{new_account_id}."
        )
        return saved

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
            duration = 0
            width = 0
            height = 0
            file_size = 0

            if getattr(msg, "video", None):
                media_type = "video"
                v = msg.video
                duration = getattr(v, "duration", 0) or 0
                width = getattr(v, "w", 0) or 0
                height = getattr(v, "h", 0) or 0
                file_size = getattr(v, "size", 0) or 0
            elif getattr(msg, "photo", None):
                media_type = "photo"
                p = msg.photo
                if getattr(p, "sizes", None):
                    largest = p.sizes[-1]
                    width = getattr(largest, "w", 0) or 0
                    height = getattr(largest, "h", 0) or 0
                    file_size = getattr(largest, "size", 0) or 0
            elif getattr(msg, "document", None):
                doc = msg.document
                file_size = getattr(doc, "size", 0) or 0
                is_video = False
                if getattr(doc, "mime_type", "").startswith("video/"):
                    is_video = True
                for attr in getattr(doc, "attributes", []):
                    if hasattr(attr, "duration"):
                        duration = getattr(attr, "duration", 0) or 0
                        width = getattr(attr, "w", 0) or 0
                        height = getattr(attr, "h", 0) or 0
                        is_video = True
                        break
                media_type = "video" if is_video else "document"

            caption = getattr(msg, "message", "") or ""

            for binding in bindings:
                if not binding.is_active:
                    continue

                # Filter gate check
                if binding.media_filter_rules:
                    try:
                        from backend.application.services.media_filter_service import MediaFilterService
                        from backend.domain.entities.video_message import VideoMessage
                        vm = VideoMessage(
                            message_id=msg_id,
                            caption=caption,
                            media_type=media_type,
                            duration=int(duration),
                            width=int(width),
                            height=int(height),
                            file_size=int(file_size),
                        )
                        passes, reject_reason = MediaFilterService().evaluate(vm, binding.media_filter_rules)
                        if not passes:
                            logger.info(
                                f"LiveSync: Skipped message #{msg_id} for target {binding.target_channel_id} by quality gate: {reject_reason}"
                            )
                            continue
                    except Exception as ex:
                        logger.warning(f"LiveSync: Error evaluating filter rules for #{msg_id}: {ex}")

                # Idempotency check: verify not already cloned via in-memory LRU cache
                if await self.is_message_already_cloned(
                    binding.source_channel_id, binding.target_channel_id, msg_id
                ):
                    logger.debug(
                        f"LiveSync: Message {msg_id} already cloned for binding {binding.source_channel_id} -> {binding.target_channel_id} (cache hit)."
                    )
                    continue

                # Mark in cache immediately to deduplicate rapid duplicate/edited push events
                self.dedup_cache.mark_cloned(
                    binding.source_channel_id, binding.target_channel_id, msg_id
                )

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
                    # Transform caption if binding has active caption rules
                    processed_caption = caption
                    if binding.caption_rules:
                        try:
                            from backend.application.services.caption_transformer_service import CaptionTransformerService
                            from backend.domain.entities.caption_rules import CaptionRules
                            rules_entity = (
                                CaptionRules(**binding.caption_rules)
                                if isinstance(binding.caption_rules, dict)
                                else binding.caption_rules
                            )
                            transformer = CaptionTransformerService()
                            if getattr(rules_entity, "ai_enabled", False):
                                processed_caption = await transformer.transform_async(caption, rules_entity)
                            else:
                                processed_caption = transformer.transform(caption, rules_entity)
                        except Exception as ex:
                            logger.warning(f"LiveSync: Failed to transform caption for msg #{msg_id}: {ex}")

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
                        caption_rules=binding.caption_rules,
                        media_filter_rules=binding.media_filter_rules,
                    )
                    await self.repo.create_job(job)

                    queue_item = QueueItem(
                        job_id=job_id,
                        source_message_id=msg_id,
                        status=QueueItemStatus.PENDING,
                        media_type=media_type,
                        caption=processed_caption,
                    )
                    await self.repo.add_queue_items([queue_item])

                # Execute migration use case for this job
                async def _on_progress(progress: dict[str, Any]) -> None:
                    try:
                        if hasattr(self.broadcaster, "publish"):
                            await self.broadcaster.publish(job_id, progress)
                        if hasattr(self.broadcaster, "broadcast"):
                            await self.broadcaster.broadcast("migration_progress", progress)
                    except Exception as be:
                        logger.debug(f"LiveSync: Progress broadcast suppressed: {be}")

                await self.use_case.execute(job_id, on_progress=_on_progress)

                # Update binding state
                binding.last_synced_message_id = max(binding.last_synced_message_id, msg_id)
                await self.repo.save_sync_binding(binding)

                try:
                    if hasattr(self.broadcaster, "broadcast"):
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
                except Exception as be:
                    logger.debug(f"LiveSync: Sync event broadcast suppressed: {be}")

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
        caption_rules: dict | None = None,
        media_filter_rules: dict | None = None,
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
            if caption_rules is not None:
                existing.caption_rules = caption_rules
            if media_filter_rules is not None:
                existing.media_filter_rules = media_filter_rules
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
                caption_rules=caption_rules,
                media_filter_rules=media_filter_rules,
            )
            saved = await self.repo.save_sync_binding(new_binding)

        await self.reload_bindings()
        self.attach_client_listeners()
        if is_active:
            asyncio.create_task(self.catch_up_delta(saved))
        return saved

    async def delete_binding(self, source_channel_id: int, target_channel_id: int) -> bool:
        """Delete an auto-sync binding and refresh active listeners."""
        success = await self.repo.delete_sync_binding(source_channel_id, target_channel_id)
        await self.reload_bindings()
        return success

    def get_health_status(self) -> dict[str, Any]:
        """Return diagnostic health and status metrics for the live sync daemon."""
        total_active_bindings = sum(len(bindings) for bindings in self._bindings.values())
        return {
            "is_running": self._is_running,
            "active_sources_count": len(self._bindings),
            "active_bindings_count": total_active_bindings,
            "attached_clients_count": len(self._attached_clients),
            "queue_depth": self._queue.qsize(),
        }

