from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import uuid


@dataclass
class FeedSource:
    """Represents an external creator profile/playlist monitored by the Auto-Pilot daemon."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default"
    title: str = "Monitored Feed"
    source_url: str = ""
    platform: str = "tiktok"  # "tiktok", "youtube", "instagram", "web"
    target_channel_id: int = 0
    target_channel_title: str | None = None
    is_active: bool = True
    check_interval_minutes: int = 60
    pipeline_config: dict[str, Any] = field(
        default_factory=lambda: {
            "aspect_ratio_mode": "9:16_BLUR",
            "burn_subtitles": True,
            "subtitle_style": "KINETIC_YELLOW",
            "slice_stories": True,
            "generate_thumbnail": True,
            "mode": "RESERVOIR",
        }
    )
    last_checked_at: str | None = None
    last_video_id: str | None = None
    total_ingested: int = 0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def pipeline_config_json(self) -> str:
        return json.dumps(self.pipeline_config)

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> FeedSource:
        raw_config = row.get("pipeline_config")
        config: dict[str, Any] = {}
        if isinstance(raw_config, str) and raw_config:
            try:
                config = json.loads(raw_config)
            except Exception:
                config = {}
        elif isinstance(raw_config, dict):
            config = raw_config

        return cls(
            id=str(row["id"]),
            tenant_id=str(row.get("tenant_id") or "default"),
            title=str(row.get("title") or "Feed"),
            source_url=str(row.get("source_url") or ""),
            platform=str(row.get("platform") or "tiktok"),
            target_channel_id=int(row.get("target_channel_id") or 0),
            target_channel_title=row.get("target_channel_title"),
            is_active=bool(row.get("is_active", True)),
            check_interval_minutes=int(row.get("check_interval_minutes") or 60),
            pipeline_config=config,
            last_checked_at=row.get("last_checked_at"),
            last_video_id=row.get("last_video_id"),
            total_ingested=int(row.get("total_ingested") or 0),
            created_at=str(row.get("created_at") or ""),
            updated_at=str(row.get("updated_at") or ""),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "title": self.title,
            "source_url": self.source_url,
            "platform": self.platform,
            "target_channel_id": self.target_channel_id,
            "target_channel_title": self.target_channel_title,
            "is_active": self.is_active,
            "check_interval_minutes": self.check_interval_minutes,
            "pipeline_config": self.pipeline_config,
            "last_checked_at": self.last_checked_at,
            "last_video_id": self.last_video_id,
            "total_ingested": self.total_ingested,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
