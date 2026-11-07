from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class ScheduledBroadcast:
    id: str
    target_ids: list[int]
    text: str
    name: str | None = None
    media_paths: list[str] = field(default_factory=list)
    account_id: int | None = None
    scheduled_at: str = ""
    recurrence: str = "ONCE"  # ONCE, EVERY_6_HOURS, EVERY_12_HOURS, DAILY, WEEKLY
    status: str = "SCHEDULED"  # SCHEDULED, RUNNING, COMPLETED, CANCELLED, FAILED
    last_run_at: str | None = None
    run_count: int = 0
    last_error: str | None = None
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
