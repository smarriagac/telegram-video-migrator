from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any

from backend.domain.entities.caption_template import CaptionTemplate
from backend.domain.entities.caption_rules import CaptionRules
from backend.application.services.caption_transformer_service import CaptionTransformerService


class TemplateService:
    """Renders and interpolates dynamic variable tokens into templates and applies sanitization rules."""

    def __init__(self, transformer: CaptionTransformerService | None = None) -> None:
        self.transformer = transformer or CaptionTransformerService()

    def build_default_context(self, user_context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Provides fallback variables for date, year, and common placeholder fields."""
        now = datetime.now(timezone.utc)
        defaults = {
            "date": now.strftime("%Y-%m-%d"),
            "year": str(now.year),
            "quality": "1080p Full HD",
            "title": "Video Exclusivo",
            "channel": "@CanalOficial",
            "index": "1",
        }
        if user_context:
            defaults.update({k: str(v) for k, v in user_context.items() if v is not None})
        return defaults

    def interpolate(self, text: str, context: dict[str, Any]) -> str:
        """Safely replaces `{var_name}` tokens in template string."""
        if not text:
            return ""

        def replacer(match: re.Match) -> str:
            token = match.group(1).strip()
            # Case-insensitive token lookup
            for k, v in context.items():
                if k.lower() == token.lower():
                    return str(v)
            # If not found in context, leave token unchanged
            return match.group(0)

        return re.sub(r"\{([a-zA-Z0-9_\-]+)\}", replacer, text)

    def render_template(
        self,
        template: CaptionTemplate,
        context: dict[str, Any] | None = None,
        apply_rules: bool = True,
    ) -> str:
        """Renders header, body with variables, signature, and optional transformer rules."""
        ctx = self.build_default_context(context)

        rendered_body = self.interpolate(template.body_template or "", ctx)
        rendered_header = self.interpolate(template.header or "", ctx) if template.header else None
        rendered_signature = (
            self.interpolate(template.signature or "", ctx) if template.signature else None
        )

        parts = []
        if rendered_header and rendered_header.strip():
            parts.append(rendered_header.strip())
        if rendered_body and rendered_body.strip():
            parts.append(rendered_body.strip())
        if rendered_signature and rendered_signature.strip():
            parts.append(rendered_signature.strip())

        composed = "\n\n".join(parts)

        if apply_rules and template.caption_rules:
            rules_entity = CaptionRules.from_dict(template.caption_rules)
            composed = self.transformer.transform(composed, rules_entity)

        return composed
