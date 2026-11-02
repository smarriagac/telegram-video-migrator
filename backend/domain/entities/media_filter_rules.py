from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class MediaFilterRules:
    """Rules for filtering media by structural MTProto metadata before migration."""

    min_duration_seconds: int | None = None
    max_duration_seconds: int | None = None
    min_width: int | None = None
    min_height: int | None = None
    min_file_size_bytes: int | None = None
    max_file_size_bytes: int | None = None
    allowed_media_types: list[str] = field(default_factory=lambda: ["video", "photo", "document", "text"])

    def to_dict(self) -> dict:
        return {
            "min_duration_seconds": self.min_duration_seconds,
            "max_duration_seconds": self.max_duration_seconds,
            "min_width": self.min_width,
            "min_height": self.min_height,
            "min_file_size_bytes": self.min_file_size_bytes,
            "max_file_size_bytes": self.max_file_size_bytes,
            "allowed_media_types": self.allowed_media_types,
        }
