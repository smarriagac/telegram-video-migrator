from __future__ import annotations

import re
from backend.domain.entities.caption_rules import CaptionRules


class CaptionTransformerService:
    """Pure domain service for cleaning, transforming, and watermarking Telegram message captions."""

    # Matches http/https links as well as bare t.me links
    URL_PATTERN = re.compile(
        r"(https?://[^\s]+|(?:^|(?<=\s))t\.me/[^\s]+)",
        re.IGNORECASE,
    )

    # Matches Telegram usernames/handles (@username)
    MENTION_PATTERN = re.compile(r"@([a-zA-Z0-9_]{3,32})\b")

    def transform(self, caption: str | None, rules: CaptionRules | None) -> str:
        """Applies configured sanitization and transformation rules to a caption string."""
        if not rules:
            return caption or ""

        text = caption or ""

        # 1. Strip HTTP / HTTPS and t.me URLs
        if rules.strip_links and text:
            text = self.URL_PATTERN.sub("", text)

        # 2. Specific mention replacements (e.g. @canal_viejo -> @canal_nuevo)
        if rules.replace_mentions and text:
            for old_handle, new_handle in rules.replace_mentions.items():
                pattern = re.compile(re.escape(old_handle), re.IGNORECASE)
                text = pattern.sub(new_handle, text)

        # 3. Strip all remaining @mentions if requested
        if rules.strip_all_mentions and text:
            text = self.MENTION_PATTERN.sub("", text)

        # 4. Remove blacklisted words or phrases
        if rules.remove_words and text:
            for word in rules.remove_words:
                if not word.strip():
                    continue
                pattern = re.compile(re.escape(word.strip()), re.IGNORECASE)
                text = pattern.sub("", text)

        # 5. Collapse excessive whitespace and blank lines (maximum 2 consecutive newlines)
        lines = [line.strip() for line in text.splitlines()]
        cleaned_text = "\n".join(lines).strip()
        cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text)

        # 6. Prepend Header
        if rules.prepend_header and rules.prepend_header.strip():
            header = rules.prepend_header.strip()
            if cleaned_text:
                cleaned_text = f"{header}\n\n{cleaned_text}"
            else:
                cleaned_text = header

        # 7. Append Signature / Footer
        if rules.append_signature and rules.append_signature.strip():
            signature = rules.append_signature.strip()
            if cleaned_text:
                cleaned_text = f"{cleaned_text}\n\n{signature}"
            else:
                cleaned_text = signature

        return cleaned_text

    async def transform_async(self, caption: str | None, rules: CaptionRules | None) -> str:
        """Applies configured sanitization, regex transformations, and async AI semantic processing."""
        base_transformed = self.transform(caption, rules)
        if not rules or not rules.ai_enabled:
            return base_transformed

        try:
            from backend.application.services.ai_caption_engine import AICaptionEngine
            engine = AICaptionEngine()
            return await engine.transform(base_transformed, rules)
        except Exception as ex:
            import logging
            logging.getLogger(__name__).warning(f"AI caption transform error: {ex}")
            return base_transformed
