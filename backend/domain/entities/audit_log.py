from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class AuditLog:
    """Represents a system audit event (security or operational action)."""

    id: int | None
    action: str  # LOGIN, USER_CREATE, USER_UPDATE, USER_DELETE, MIGRATION_START, AUTO_SYNC_TOGGLE, etc.
    user_id: int | None = None
    user_email: str | None = None
    resource: str | None = None
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    created_at: str | None = None
