from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.audit_log import AuditLog


class AuditRepositoryPort(ABC):
    """Port for recording and querying security and operational audit logs."""

    @abstractmethod
    async def record_audit_log(self, log: AuditLog) -> AuditLog:
        """Persist a new audit log entry."""
        raise NotImplementedError

    @abstractmethod
    async def list_audit_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        action: str | None = None,
        user_email: str | None = None,
    ) -> list[AuditLog]:
        """Query audit logs with optional filters."""
        raise NotImplementedError

    @abstractmethod
    async def count_audit_logs(
        self,
        action: str | None = None,
        user_email: str | None = None,
    ) -> int:
        """Count total audit logs matching optional filters."""
        raise NotImplementedError
