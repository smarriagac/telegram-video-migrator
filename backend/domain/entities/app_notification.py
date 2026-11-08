from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import uuid


@dataclass
class AppNotification:
    """Represents an in-app operational notification displayed in the top bar center."""

    id: str
    tenant_id: str = "default"
    title: str = ""
    message: str = ""
    severity: str = "INFO"  # "INFO" | "SUCCESS" | "WARNING" | "ERROR"
    is_read: bool = False
    link: str | None = None
    created_at: str | None = None

    @classmethod
    def create(
        cls,
        title: str,
        message: str,
        severity: str = "INFO",
        tenant_id: str = "default",
        link: str | None = None,
    ) -> AppNotification:
        return cls(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id or "default",
            title=title,
            message=message,
            severity=severity.upper(),
            is_read=False,
            link=link,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
