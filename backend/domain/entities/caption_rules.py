from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class CaptionRules:
    """Configurable transformation rules for media captions."""

    strip_links: bool = False
    strip_all_mentions: bool = False
    replace_mentions: Dict[str, str] = field(default_factory=dict)
    remove_words: List[str] = field(default_factory=list)
    append_signature: Optional[str] = None
    prepend_header: Optional[str] = None
    ai_enabled: bool = False
    ai_target_lang: Optional[str] = None
    ai_tone: Optional[str] = None
    ai_auto_hashtags: bool = False
    ai_clean_spam: bool = False
    ai_summarize: bool = False

    @classmethod
    def from_dict(cls, data: dict | None) -> CaptionRules:
        if not data:
            return cls()
        return cls(
            strip_links=bool(data.get("strip_links", False)),
            strip_all_mentions=bool(data.get("strip_all_mentions", False)),
            replace_mentions=dict(data.get("replace_mentions", {})),
            remove_words=list(data.get("remove_words", [])),
            append_signature=data.get("append_signature"),
            prepend_header=data.get("prepend_header"),
            ai_enabled=bool(data.get("ai_enabled", False)),
            ai_target_lang=data.get("ai_target_lang"),
            ai_tone=data.get("ai_tone"),
            ai_auto_hashtags=bool(data.get("ai_auto_hashtags", False)),
            ai_clean_spam=bool(data.get("ai_clean_spam", False)),
            ai_summarize=bool(data.get("ai_summarize", False)),
        )

    def to_dict(self) -> dict:
        return {
            "strip_links": self.strip_links,
            "strip_all_mentions": self.strip_all_mentions,
            "replace_mentions": self.replace_mentions,
            "remove_words": self.remove_words,
            "append_signature": self.append_signature,
            "prepend_header": self.prepend_header,
            "ai_enabled": self.ai_enabled,
            "ai_target_lang": self.ai_target_lang,
            "ai_tone": self.ai_tone,
            "ai_auto_hashtags": self.ai_auto_hashtags,
            "ai_clean_spam": self.ai_clean_spam,
            "ai_summarize": self.ai_summarize,
        }
