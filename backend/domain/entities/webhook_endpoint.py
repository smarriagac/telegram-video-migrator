from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import uuid
from typing import Any


@dataclass
class WebhookEndpoint:
    """Represents a webhook destination for operational notifications and alerts."""

    name: str
    target_type: str  # DISCORD, SLACK, TELEGRAM_BOT, GENERIC
    url: str
    id: str = field(default_factory=lambda: f"whk_{uuid.uuid4().hex[:12]}")
    tenant_id: str = "00000000-0000-0000-0000-000000000001"
    secret_token: str | None = None
    events: list[str] = field(default_factory=lambda: ["job.failed", "flood_wait", "backup.created", "channel.eviction"])
    is_enabled: bool = True
    last_status_code: int | None = None
    last_error: str | None = None
    last_dispatched_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def subscribes_to(self, event_name: str) -> bool:
        """Check if this endpoint subscribes to a given event (e.g., 'flood_wait')."""
        if not self.is_enabled:
            return False
        if "*" in self.events or event_name in self.events:
            return True
        return False

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "target_type": self.target_type,
            "url": self.url,
            "secret_token": self.secret_token,
            "events": self.events,
            "is_enabled": self.is_enabled,
            "last_status_code": self.last_status_code,
            "last_error": self.last_error,
            "last_dispatched_at": self.last_dispatched_at.isoformat() if self.last_dispatched_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WebhookEndpoint:
        def parse_dt(val: Any) -> datetime | None:
            if not val:
                return None
            if isinstance(val, datetime):
                return val
            try:
                return datetime.fromisoformat(val)
            except Exception:
                return None

        return cls(
            id=str(data.get("id") or f"whk_{uuid.uuid4().hex[:12]}"),
            tenant_id=str(data.get("tenant_id") or "00000000-0000-0000-0000-000000000001"),
            name=str(data.get("name") or "Webhook"),
            target_type=str(data.get("target_type") or "GENERIC").upper(),
            url=str(data.get("url") or ""),
            secret_token=data.get("secret_token"),
            events=data.get("events") or ["job.failed", "flood_wait", "backup.created", "channel.eviction"],
            is_enabled=bool(data.get("is_enabled", True)),
            last_status_code=data.get("last_status_code"),
            last_error=data.get("last_error"),
            last_dispatched_at=parse_dt(data.get("last_dispatched_at")),
            created_at=parse_dt(data.get("created_at")) or datetime.now(timezone.utc),
            updated_at=parse_dt(data.get("updated_at")) or datetime.now(timezone.utc),
        )
