from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.caption_template import CaptionTemplate


class TemplateRepositoryPort(ABC):
    """Port for managing predefined caption and message templates."""

    @abstractmethod
    async def create_template(self, template: CaptionTemplate) -> CaptionTemplate:
        """Store a new caption template."""
        raise NotImplementedError

    @abstractmethod
    async def get_template(self, template_id: str, tenant_id: str) -> CaptionTemplate | None:
        """Fetch a specific template by ID within a tenant."""
        raise NotImplementedError

    @abstractmethod
    async def list_templates(self, tenant_id: str, category: str | None = None) -> list[CaptionTemplate]:
        """Query templates scoped by tenant and optional category."""
        raise NotImplementedError

    @abstractmethod
    async def update_template(self, template: CaptionTemplate) -> CaptionTemplate | None:
        """Update an existing template."""
        raise NotImplementedError

    @abstractmethod
    async def delete_template(self, template_id: str, tenant_id: str) -> bool:
        """Delete a template from storage."""
        raise NotImplementedError
