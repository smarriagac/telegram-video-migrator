from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
from typing import Any


class WebhookDeliveryStatus(str, Enum):
    PENDING = "PENDING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    DLQ = "DLQ"


@dataclass
class WebhookDelivery:
    """Represents an individual delivery attempt or queued retry for a webhook notification."""

    webhook_id: str
    event_type: str
    url: str
    payload: dict[str, Any]
    id: str = field(default_factory=lambda: f"deliv_{uuid.uuid4().hex[:14]}")
    tenant_id: str = "00000000-0000-0000-0000-000000000001"
    status: str = WebhookDeliveryStatus.PENDING.value
    attempts: int = 0
    max_attempts: int = 5
    next_retry_at: datetime | None = None
    last_status_code: int | None = None
    last_error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @staticmethod
    def compute_next_retry(attempts: int, base_seconds: int = 30, max_seconds: int = 3600) -> datetime:
        """Calculate exponential backoff time with a ceiling."""
        delay = min(base_seconds * (2 ** max(0, attempts - 1)), max_seconds)
        return datetime.now(timezone.utc) + timedelta(seconds=delay)

    def mark_success(self, status_code: int) -> None:
        self.status = WebhookDeliveryStatus.DELIVERED.value
        self.last_status_code = status_code
        self.last_error = None
        self.next_retry_at = None
        self.updated_at = datetime.now(timezone.utc)

    def mark_failure(self, status_code: int | None, error: str) -> None:
        self.attempts += 1
        self.last_status_code = status_code
        self.last_error = error
        self.updated_at = datetime.now(timezone.utc)

        if self.attempts >= self.max_attempts:
            self.status = WebhookDeliveryStatus.DLQ.value
            self.next_retry_at = None
        else:
            self.status = WebhookDeliveryStatus.PENDING.value
            self.next_retry_at = self.compute_next_retry(self.attempts)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "webhook_id": self.webhook_id,
            "tenant_id": self.tenant_id,
            "event_type": self.event_type,
            "url": self.url,
            "payload": self.payload,
            "status": self.status,
            "attempts": self.attempts,
            "max_attempts": self.max_attempts,
            "next_retry_at": self.next_retry_at.isoformat() if self.next_retry_at else None,
            "last_status_code": self.last_status_code,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WebhookDelivery:
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
            id=data.get("id", f"deliv_{uuid.uuid4().hex[:14]}"),
            webhook_id=data["webhook_id"],
            tenant_id=data.get("tenant_id", "00000000-0000-0000-0000-000000000001"),
            event_type=data.get("event_type", "unknown"),
            url=data.get("url", ""),
            payload=data.get("payload") or {},
            status=data.get("status", WebhookDeliveryStatus.PENDING.value),
            attempts=int(data.get("attempts", 0)),
            max_attempts=int(data.get("max_attempts", 5)),
            next_retry_at=parse_dt(data.get("next_retry_at")),
            last_status_code=data.get("last_status_code"),
            last_error=data.get("last_error"),
            created_at=parse_dt(data.get("created_at")) or datetime.now(timezone.utc),
            updated_at=parse_dt(data.get("updated_at")) or datetime.now(timezone.utc),
        )
