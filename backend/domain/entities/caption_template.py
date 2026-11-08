from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import uuid


@dataclass
class CaptionTemplate:
    """Predefined reusable caption or broadcast message template with dynamic variable tokens."""

    name: str
    body_template: str
    id: str = field(default_factory=lambda: f"tpl_{uuid.uuid4().hex[:12]}")
    tenant_id: str = "00000000-0000-0000-0000-000000000001"
    category: str = "GENERAL"  # "MIGRATION", "BROADCAST", "WATERMARK", "GENERAL"
    header: str | None = None
    signature: str | None = None
    caption_rules: dict[str, Any] | None = None
    is_default: bool = False
    created_at: str | None = None
    updated_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "category": self.category,
            "header": self.header,
            "body_template": self.body_template,
            "signature": self.signature,
            "caption_rules": self.caption_rules,
            "is_default": self.is_default,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CaptionTemplate:
        return cls(
            id=data.get("id") or f"tpl_{uuid.uuid4().hex[:12]}",
            tenant_id=data.get("tenant_id") or "00000000-0000-0000-0000-000000000001",
            name=data["name"],
            category=data.get("category", "GENERAL"),
            header=data.get("header"),
            body_template=data.get("body_template", ""),
            signature=data.get("signature"),
            caption_rules=data.get("caption_rules"),
            is_default=bool(data.get("is_default", False)),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )
