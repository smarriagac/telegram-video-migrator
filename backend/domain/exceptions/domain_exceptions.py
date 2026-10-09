from __future__ import annotations

class DomainException(Exception):
    """Base exception for domain layer errors."""

    pass


class ChannelAccessDeniedException(DomainException):
    """Raised when access to a channel is denied or permissions are insufficient."""

    def __init__(self, message: str = "Access to channel denied or insufficient permissions.") -> None:
        super().__init__(message)


class FloodWaitDomainException(DomainException):
    """Raised when Telegram imposes a flood wait cooldown."""

    def __init__(self, seconds: int, message: str | None = None) -> None:
        self.seconds = seconds
        super().__init__(message or f"Telegram flood wait triggered. Must wait {seconds} seconds.")


class JobNotFoundException(DomainException):
    """Raised when a migration job is not found."""

    def __init__(self, job_id: str, message: str | None = None) -> None:
        self.job_id = job_id
        super().__init__(message or f"Migration job '{job_id}' not found.")
