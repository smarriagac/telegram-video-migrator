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
        )

    def to_dict(self) -> dict:
        return {
            "strip_links": self.strip_links,
            "strip_all_mentions": self.strip_all_mentions,
            "replace_mentions": self.replace_mentions,
            "remove_words": self.remove_words,
            "append_signature": self.append_signature,
            "prepend_header": self.prepend_header,
        }
