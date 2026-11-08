from __future__ import annotations

import asyncio
from datetime import datetime, time, timedelta, timezone
import logging
import random
import uuid
from typing import Any

from backend.domain.entities.drip_campaign import (
    CampaignStatus,
    DripCampaign,
    ReservoirItem,
    ReservoirItemStatus,
)
from backend.domain.entities.video_message import VideoMessage
from backend.domain.entities.caption_rules import CaptionRules
from backend.domain.entities.audit_log import AuditLog
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.application.broadcaster import EventBroadcaster
from backend.application.services.caption_transformer_service import CaptionTransformerService

logger = logging.getLogger(__name__)


class DripCampaignService:
    """Enterprise Content Reservoir and Scheduled Drip Campaign Engine."""

    def __init__(
        self,
        job_repo: JobRepositoryPort,
        telegram_gateway: TelegramGatewayPort,
        caption_transformer: CaptionTransformerService | None = None,
        broadcaster: EventBroadcaster | None = None,
        audit_repo: AuditRepositoryPort | None = None,
        poll_interval: float = 15.0,
    ) -> None:
        self.job_repo = job_repo
        self.gateway = telegram_gateway
        self.caption_transformer = caption_transformer or CaptionTransformerService()
        self.broadcaster = broadcaster
        self.audit_repo = audit_repo
        self.poll_interval = poll_interval
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("DripCampaignService background worker loop started.")

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("DripCampaignService background worker loop stopped.")

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                await self.check_and_trigger_drip()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Error in DripCampaignService loop: {e}")
            await asyncio.sleep(self.poll_interval)

    @staticmethod
    def parse_time_str(time_str: str) -> time:
        """Parses 'HH:MM' into a time object."""
        parts = time_str.strip().split(":")
        return time(int(parts[0]), int(parts[1]))

    @classmethod
    def compute_schedule_timeline(
        cls,
        start_dt: datetime,
        count: int,
        interval_minutes: int = 60,
        batch_size: int = 1,
        jitter_seconds: int = 0,
        daily_window_start: str | None = None,
        daily_window_end: str | None = None,
    ) -> list[str]:
        """Calculates a list of ISO-formatted scheduled timestamps adhering to intervals,

        batch sizes, optional daily active time windows, and jitter.
        """
        if count <= 0:
            return []

        if start_dt.tzinfo is None:
            current_dt = start_dt.replace(tzinfo=timezone.utc)
        else:
            current_dt = start_dt

        w_start: time | None = None
        w_end: time | None = None
        if daily_window_start and daily_window_end:
            try:
                w_start = cls.parse_time_str(daily_window_start)
                w_end = cls.parse_time_str(daily_window_end)
            except Exception as e:
                logger.warning(f"Invalid daily window string: {e}")

        def clamp_to_window(dt: datetime) -> datetime:
            if not w_start or not w_end:
                return dt

            cur_time = dt.time()
            if cur_time < w_start:
                # Before opening window: advance to window_start on same day
                return dt.replace(
                    hour=w_start.hour,
                    minute=w_start.minute,
                    second=0,
                    microsecond=0,
                )
            elif cur_time > w_end:
                # After closing window: advance to window_start on next day
                next_day = dt + timedelta(days=1)
                return next_day.replace(
                    hour=w_start.hour,
                    minute=w_start.minute,
                    second=0,
                    microsecond=0,
                )
            return dt

        schedule: list[str] = []
        batch_sz = max(1, batch_size)

        for i in range(count):
            batch_idx = i // batch_sz
            base_dt = current_dt + timedelta(
                minutes=batch_idx * max(1, interval_minutes)
            )

            # Apply jitter if configured
            if jitter_seconds > 0:
                jitter_delta = random.randint(-jitter_seconds, jitter_seconds)
                base_dt = base_dt + timedelta(seconds=jitter_delta)
                if base_dt < current_dt:
                    base_dt = current_dt

            # Adjust for daily operating window
            adjusted_dt = clamp_to_window(base_dt)
            schedule.append(adjusted_dt.isoformat())

        return schedule

    async def create_campaign(
        self,
        title: str,
        source_channel_id: int,
        target_channel_id: int,
        source_message_ids: list[int],
        source_channel_title: str | None = None,
        target_channel_title: str | None = None,
        source_account_id: int | None = None,
        target_account_id: int | None = None,
        interval_minutes: int = 60,
        batch_size: int = 1,
        jitter_seconds: int = 0,
        daily_window_start: str | None = None,
        daily_window_end: str | None = None,
        caption_rules: dict[str, Any] | None = None,
        start_at: datetime | None = None,
    ) -> DripCampaign:
        """Initializes a new Content Reservoir campaign and stages items with calculated timeline."""
        campaign_id = f"camp_{uuid.uuid4().hex[:12]}"
        now = start_at or datetime.now(timezone.utc)
        now_iso = now.isoformat()

        timeline = self.compute_schedule_timeline(
            start_dt=now,
            count=len(source_message_ids),
            interval_minutes=interval_minutes,
            batch_size=batch_size,
            jitter_seconds=jitter_seconds,
            daily_window_start=daily_window_start,
            daily_window_end=daily_window_end,
        )

        items: list[ReservoirItem] = []
        for idx, msg_id in enumerate(source_message_ids):
            item = ReservoirItem(
                id=f"res_{uuid.uuid4().hex[:12]}",
                campaign_id=campaign_id,
                source_message_id=msg_id,
                media_type="video",
                original_caption="",
                transformed_caption="",
                status=ReservoirItemStatus.QUEUED,
                scheduled_at=timeline[idx] if idx < len(timeline) else now_iso,
                position=idx + 1,
                created_at=now_iso,
            )
            items.append(item)

        next_release = timeline[0] if timeline else None

        campaign = DripCampaign(
            id=campaign_id,
            title=title or f"Campaña Drip #{source_channel_id} -> #{target_channel_id}",
            source_channel_id=source_channel_id,
            target_channel_id=target_channel_id,
            source_channel_title=source_channel_title,
            target_channel_title=target_channel_title,
            source_account_id=source_account_id,
            target_account_id=target_account_id,
            status=CampaignStatus.ACTIVE,
            interval_minutes=interval_minutes,
            batch_size=batch_size,
            jitter_seconds=jitter_seconds,
            daily_window_start=daily_window_start,
            daily_window_end=daily_window_end,
            caption_rules=caption_rules,
            next_release_at=next_release,
            total_items=len(items),
            released_items=0,
            failed_items=0,
            created_at=now_iso,
            updated_at=now_iso,
        )

        saved = await self.job_repo.create_drip_campaign(campaign, items)

        if self.audit_repo:
            try:
                await self.audit_repo.create_log(
                    AuditLog(
                        id=f"audit_{uuid.uuid4().hex[:12]}",
                        action="DRIP_CAMPAIGN_CREATED",
                        details={
                            "campaign_id": campaign_id,
                            "title": title,
                            "items_count": len(items),
                            "interval_minutes": interval_minutes,
                            "target_channel_id": target_channel_id,
                        },
                        created_at=now_iso,
                    )
                )
            except Exception as e:
                logger.warning(f"Could not record audit log: {e}")

        if self.broadcaster:
            await self.broadcaster.broadcast(
                "drip",
                {
                    "event": "CAMPAIGN_CREATED",
                    "campaign_id": campaign_id,
                    "total_items": len(items),
                },
            )

        return saved

    async def pause_campaign(self, campaign_id: str) -> bool:
        camp = await self.job_repo.get_drip_campaign(campaign_id)
        if not camp:
            return False
        camp.status = CampaignStatus.PAUSED
        camp.updated_at = datetime.now(timezone.utc).isoformat()
        res = await self.job_repo.update_drip_campaign(camp)
        if res and self.broadcaster:
            await self.broadcaster.broadcast(
                "drip", {"event": "CAMPAIGN_PAUSED", "campaign_id": campaign_id}
            )
        return res

    async def resume_campaign(self, campaign_id: str) -> bool:
        camp = await self.job_repo.get_drip_campaign(campaign_id)
        if not camp:
            return False
        now_dt = datetime.now(timezone.utc)
        camp.status = CampaignStatus.ACTIVE
        # If next release is in the past, align with now
        if camp.next_release_at:
            try:
                parsed_next = datetime.fromisoformat(camp.next_release_at)
                if parsed_next < now_dt:
                    camp.next_release_at = now_dt.isoformat()
            except Exception:
                camp.next_release_at = now_dt.isoformat()
        else:
            camp.next_release_at = now_dt.isoformat()

        camp.updated_at = now_dt.isoformat()
        res = await self.job_repo.update_drip_campaign(camp)
        if res and self.broadcaster:
            await self.broadcaster.broadcast(
                "drip", {"event": "CAMPAIGN_RESUMED", "campaign_id": campaign_id}
            )
        return res

    async def cancel_campaign(self, campaign_id: str) -> bool:
        camp = await self.job_repo.get_drip_campaign(campaign_id)
        if not camp:
            return False
        camp.status = CampaignStatus.CANCELLED
        camp.updated_at = datetime.now(timezone.utc).isoformat()
        res = await self.job_repo.update_drip_campaign(camp)
        if res and self.broadcaster:
            await self.broadcaster.broadcast(
                "drip", {"event": "CAMPAIGN_CANCELLED", "campaign_id": campaign_id}
            )
        return res

    async def skip_item(self, item_id: str) -> bool:
        item = await self.job_repo.get_reservoir_item(item_id)
        if not item:
            return False
        item.status = ReservoirItemStatus.SKIPPED
        res = await self.job_repo.update_reservoir_item(item)
        if res:
            # Advance campaign total/state if needed
            camp = await self.job_repo.get_drip_campaign(item.campaign_id)
            if camp:
                await self._refresh_campaign_next_release(camp)
            if self.broadcaster:
                await self.broadcaster.broadcast(
                    "drip", {"event": "ITEM_SKIPPED", "item_id": item_id}
                )
        return res

    async def update_item_caption(
        self, item_id: str, new_caption: str
    ) -> ReservoirItem | None:
        item = await self.job_repo.get_reservoir_item(item_id)
        if not item:
            return None
        item.transformed_caption = new_caption
        await self.job_repo.update_reservoir_item(item)
        return item

    async def release_item_now(
        self, item_id: str
    ) -> tuple[bool, ReservoirItem | None]:
        """Manually trigger immediate dispatch of an item regardless of scheduled time."""
        item = await self.job_repo.get_reservoir_item(item_id)
        if not item:
            return False, None
        camp = await self.job_repo.get_drip_campaign(item.campaign_id)
        if not camp:
            return False, item

        success = await self._dispatch_reservoir_item(camp, item)
        await self._refresh_campaign_next_release(camp)

        if self.broadcaster:
            await self.broadcaster.broadcast(
                "drip",
                {
                    "event": "ITEM_RELEASED",
                    "item_id": item.id,
                    "campaign_id": camp.id,
                    "success": success,
                },
            )

        return success, item

    async def _refresh_campaign_next_release(self, camp: DripCampaign) -> None:
        """Finds next QUEUED item in campaign and updates next_release_at; marks COMPLETED if done."""
        queued_items, total_queued = await self.job_repo.list_reservoir_items(
            campaign_id=camp.id, status=ReservoirItemStatus.QUEUED.value, limit=1
        )
        if total_queued > 0 and queued_items:
            camp.next_release_at = queued_items[0].scheduled_at
        else:
            camp.next_release_at = None
            camp.status = CampaignStatus.COMPLETED

        camp.updated_at = datetime.now(timezone.utc).isoformat()
        await self.job_repo.update_drip_campaign(camp)

    async def check_and_trigger_drip(self) -> list[str]:
        """Scans for due items from active campaigns and dispatches them."""
        now_iso = datetime.now(timezone.utc).isoformat()
        due_pairs = await self.job_repo.get_due_drip_items(now_iso)
        if not due_pairs:
            return []

        dispatched_ids: list[str] = []
        affected_campaigns: dict[str, DripCampaign] = {}

        for camp, item in due_pairs:
            success = await self._dispatch_reservoir_item(camp, item)
            dispatched_ids.append(item.id)
            affected_campaigns[camp.id] = camp

        # Refresh next_release_at and status for affected campaigns
        for camp in affected_campaigns.values():
            await self._refresh_campaign_next_release(camp)

        return dispatched_ids

    async def _dispatch_reservoir_item(
        self, camp: DripCampaign, item: ReservoirItem
    ) -> bool:
        """Executes actual Telegram transfer for an individual reservoir item."""
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            # 1. Prepare caption
            caption_to_send = item.transformed_caption
            if not caption_to_send and camp.caption_rules:
                rules_entity = CaptionRules(**camp.caption_rules)
                if getattr(rules_entity, "ai_enabled", False):
                    caption_to_send = (
                        await self.caption_transformer.transform_async(
                            item.original_caption, rules_entity
                        )
                    )
                else:
                    caption_to_send = self.caption_transformer.transform(
                        item.original_caption, rules_entity
                    )

            target_acc = camp.target_account_id or camp.source_account_id
            is_cross_account = (
                camp.source_account_id is not None
                and camp.target_account_id is not None
                and camp.source_account_id != camp.target_account_id
            )

            video_msg = VideoMessage(
                message_id=item.source_message_id,
                caption=caption_to_send,
                media_type=item.media_type or "video",
                source_channel_id=camp.source_channel_id,
                entities=[],
            )

            # 2. Dispatch via gateway
            published_msg_id: int | None = None
            if is_cross_account:
                published_msg_id = await self.gateway.copy_media_cross_account(
                    source_channel_id=camp.source_channel_id,
                    target_channel_id=camp.target_channel_id,
                    video=video_msg,
                    source_account_id=camp.source_account_id,  # type: ignore
                    target_account_id=target_acc,  # type: ignore
                )
            else:
                published_msg_id = await self.gateway.copy_video_by_reference(
                    camp.target_channel_id,
                    video=video_msg,
                    account_id=target_acc,
                )

            # 3. Mark success
            item.status = ReservoirItemStatus.RELEASED
            item.released_at = now_iso
            item.published_message_id = published_msg_id
            item.error_message = None
            await self.job_repo.update_reservoir_item(item)

            camp.released_items += 1
            await self.job_repo.update_drip_campaign(camp)

            if self.audit_repo:
                await self.audit_repo.create_log(
                    AuditLog(
                        id=f"audit_{uuid.uuid4().hex[:12]}",
                        action="DRIP_ITEM_RELEASED",
                        details={
                            "campaign_id": camp.id,
                            "item_id": item.id,
                            "source_msg_id": item.source_message_id,
                            "published_msg_id": published_msg_id,
                        },
                        created_at=now_iso,
                    )
                )
            return True

        except Exception as e:
            logger.error(
                f"Failed to dispatch reservoir item {item.id} in campaign {camp.id}: {e}"
            )
            item.status = ReservoirItemStatus.FAILED
            item.error_message = str(e)
            await self.job_repo.update_reservoir_item(item)

            camp.failed_items += 1
            await self.job_repo.update_drip_campaign(camp)
            return False
