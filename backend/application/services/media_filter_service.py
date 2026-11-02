from __future__ import annotations

from typing import Any
from backend.domain.entities.media_filter_rules import MediaFilterRules
from backend.domain.entities.video_message import VideoMessage


class MediaFilterService:
    """Evaluates media items against configurable metadata and quality constraints."""

    def evaluate(
        self, video: VideoMessage, rules: MediaFilterRules | dict | None
    ) -> tuple[bool, str | None]:
        """
        Evaluates whether a VideoMessage satisfies the filter rules.
        Returns: (passes: bool, reason_if_rejected: str | None)
        """
        if not rules:
            return True, None

        if isinstance(rules, dict):
            rule_obj = MediaFilterRules(
                min_duration_seconds=rules.get("min_duration_seconds"),
                max_duration_seconds=rules.get("max_duration_seconds"),
                min_width=rules.get("min_width"),
                min_height=rules.get("min_height"),
                min_file_size_bytes=rules.get("min_file_size_bytes"),
                max_file_size_bytes=rules.get("max_file_size_bytes"),
                allowed_media_types=rules.get(
                    "allowed_media_types", ["video", "photo", "document", "text"]
                ),
            )
        else:
            rule_obj = rules

        # 1. Check allowed media types
        media_type = (getattr(video, "media_type", None) or "video").lower()
        allowed_types = [t.lower() for t in rule_obj.allowed_media_types or []]
        if allowed_types and media_type not in allowed_types:
            return False, f"Tipo de medio '{media_type}' no permitido por el filtro."

        duration = getattr(video, "duration", 0) or 0
        file_size = getattr(video, "file_size", 0) or 0
        width = getattr(video, "width", 0) or 0
        height = getattr(video, "height", 0) or 0

        # 2. Duration checks (only applies if item is video/audio with duration > 0)
        if duration > 0:
            if (
                rule_obj.min_duration_seconds is not None
                and rule_obj.min_duration_seconds > 0
                and duration < rule_obj.min_duration_seconds
            ):
                return (
                    False,
                    f"Duración ({duration}s) menor al mínimo requerido ({rule_obj.min_duration_seconds}s).",
                )

            if (
                rule_obj.max_duration_seconds is not None
                and rule_obj.max_duration_seconds > 0
                and duration > rule_obj.max_duration_seconds
            ):
                return (
                    False,
                    f"Duración ({duration}s) excede el máximo permitido ({rule_obj.max_duration_seconds}s).",
                )

        # 3. Quality & Resolution checks (applies if resolution is known)
        if height > 0:
            if rule_obj.min_height is not None and rule_obj.min_height > 0 and height < rule_obj.min_height:
                return (
                    False,
                    f"Resolución vertical ({height}p) menor al estándar requerido ({rule_obj.min_height}p).",
                )

        if width > 0:
            if rule_obj.min_width is not None and rule_obj.min_width > 0 and width < rule_obj.min_width:
                return (
                    False,
                    f"Resolución horizontal ({width}px) menor al estándar requerido ({rule_obj.min_width}px).",
                )

        # 4. File size checks
        if file_size > 0:
            if (
                rule_obj.min_file_size_bytes is not None
                and rule_obj.min_file_size_bytes > 0
                and file_size < rule_obj.min_file_size_bytes
            ):
                mb = round(file_size / (1024 * 1024), 2)
                min_mb = round(rule_obj.min_file_size_bytes / (1024 * 1024), 2)
                return False, f"Tamaño ({mb} MB) menor al mínimo requerido ({min_mb} MB)."

            if (
                rule_obj.max_file_size_bytes is not None
                and rule_obj.max_file_size_bytes > 0
                and file_size > rule_obj.max_file_size_bytes
            ):
                mb = round(file_size / (1024 * 1024), 2)
                max_mb = round(rule_obj.max_file_size_bytes / (1024 * 1024), 2)
                return False, f"Tamaño ({mb} MB) excede el límite permitido ({max_mb} MB)."

        return True, None
