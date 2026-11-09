from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any
import yt_dlp

from backend.domain.entities.feed_source import FeedSource
from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.application.services.media_ingestion_service import MediaIngestionService

logger = logging.getLogger("telegram_migrator.feed_watcher")


class FeedWatcherService:
    """Monitors external creator feeds and orchestrates unattended autonomous ingestion."""

    def __init__(
        self,
        repository: JobRepositoryPort,
        ingestion_service: MediaIngestionService,
    ) -> None:
        self.repository = repository
        self.ingestion_service = ingestion_service

    @classmethod
    def extract_recent_entries(cls, source_url: str, limit: int = 5) -> list[dict[str, Any]]:
        """Extracts recent video metadata items from a profile or playlist without downloading media."""
        clean_url = source_url.strip()
        ydl_opts: dict[str, Any] = {
            "extract_flat": True,
            "playlistend": limit,
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=False)
                if not info:
                    return []

                entries = info.get("entries")
                if entries is not None:
                    raw_items = list(entries)[:limit]
                else:
                    # Single video passed as feed
                    raw_items = [info]

                results: list[dict[str, Any]] = []
                for item in raw_items:
                    if not item:
                        continue
                    item_id = str(item.get("id") or "")
                    item_url = item.get("url") or item.get("webpage_url") or ""
                    if not item_url and item_id:
                        if "tiktok.com" in clean_url:
                            item_url = f"https://www.tiktok.com/video/{item_id}"
                        elif "youtube.com" in clean_url or "youtu.be" in clean_url:
                            item_url = f"https://www.youtube.com/watch?v={item_id}"

                    title = item.get("title") or "Auto-ingested Video"
                    if item_url or item_id:
                        results.append(
                            {
                                "id": item_id,
                                "url": item_url or clean_url,
                                "title": title,
                                "duration": item.get("duration"),
                            }
                        )
                return results
        except Exception as e:
            logger.warning(f"Feed extraction warning for {clean_url}: {e}")
            return []

    async def poll_source(self, source: FeedSource, force: bool = False) -> dict[str, Any]:
        """Polls an individual feed source, detects uningested videos, and runs them through the pipeline."""
        now_str = datetime.now(timezone.utc).isoformat()
        logger.info(f"FeedWatcher: Polling feed '{source.title}' ({source.source_url})...")

        entries = await asyncio.to_thread(self.extract_recent_entries, source.source_url, 5)
        if not entries:
            source.last_checked_at = now_str
            await self.repository.update_feed_source(source)
            return {
                "source_id": source.id,
                "status": "NO_NEW_ITEMS",
                "ingested_count": 0,
                "entries_found": 0,
            }

        # Determine which videos are new
        new_entries: list[dict[str, Any]] = []
        if not source.last_video_id or force:
            # First run: process only the latest 1 video to avoid accidental spam
            new_entries = [entries[0]]
        else:
            for e in entries:
                if e["id"] == source.last_video_id or e["url"] == source.last_video_id:
                    break
                new_entries.append(e)

        # Process from oldest to newest so they appear in chronological order
        new_entries.reverse()

        ingested_count = 0
        latest_processed_id = source.last_video_id
        config = source.pipeline_config or {}

        for entry in new_entries:
            try:
                target_url = entry["url"]
                logger.info(
                    f"FeedWatcher: Ingesting '{entry['title']}' ({target_url}) for channel {source.target_channel_id}..."
                )
                res = await self.ingestion_service.ingest(
                    tenant_id=source.tenant_id,
                    url=target_url,
                    target_channel_id=source.target_channel_id,
                    mode=config.get("mode", "RESERVOIR"),
                    campaign_id=config.get("campaign_id"),
                    aspect_ratio_mode=config.get("aspect_ratio_mode", "9:16_BLUR"),
                    branding_text=config.get("branding_text"),
                    burn_subtitles=config.get("burn_subtitles", True),
                    subtitle_style=config.get("subtitle_style", "KINETIC_YELLOW"),
                    slice_stories=config.get("slice_stories", True),
                    slice_dispatch_mode=config.get("slice_dispatch_mode", "ALBUM"),
                    generate_thumbnail=config.get("generate_thumbnail", True),
                )
                if res.get("success"):
                    ingested_count += 1
                    latest_processed_id = entry["id"] or entry["url"]
            except Exception as ing_err:
                logger.error(f"FeedWatcher: Failed to ingest item {entry.get('id')}: {ing_err}", exc_info=True)

        source.total_ingested += ingested_count
        source.last_checked_at = now_str
        if latest_processed_id:
            source.last_video_id = latest_processed_id

        await self.repository.update_feed_source(source)

        return {
            "source_id": source.id,
            "status": "SUCCESS",
            "ingested_count": ingested_count,
            "latest_video_id": source.last_video_id,
            "total_ingested": source.total_ingested,
        }

    async def check_all_due_sources(self) -> int:
        """Finds all active feed sources whose check_interval_minutes has elapsed and triggers polling."""
        active_sources = await self.repository.list_feed_sources(active_only=True)
        total_ingested = 0
        now = datetime.now(timezone.utc)

        for source in active_sources:
            is_due = True
            if source.last_checked_at:
                try:
                    last_dt = datetime.fromisoformat(source.last_checked_at)
                    diff_mins = (now - last_dt).total_seconds() / 60.0
                    is_due = diff_mins >= max(1, source.check_interval_minutes)
                except Exception:
                    is_due = True

            if is_due:
                try:
                    res = await self.poll_source(source)
                    total_ingested += res.get("ingested_count", 0)
                except Exception as poll_err:
                    logger.error(f"FeedWatcher: Error checking source {source.id}: {poll_err}")

        return total_ingested
