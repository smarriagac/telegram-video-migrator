from __future__ import annotations

import hashlib
from typing import Any


class FingerprintService:
    """Computes deterministic structural and perceptual fingerprints for Telegram media."""

    def compute_fingerprint(
        self,
        media_type: str,
        input_document_id: int | None = None,
        file_size: int | None = None,
        duration: int | None = None,
        width: int | None = None,
        height: int | None = None,
        caption: str | None = None,
        extra_key: str | None = None,
    ) -> str | None:
        """Computes a SHA-256 fingerprint hash based on media attributes or document ID."""
        # 1. MTProto Document ID is globally unique for uploaded media in Telegram
        if input_document_id and input_document_id > 0:
            raw = f"doc:{input_document_id}"
            return hashlib.sha256(raw.encode("utf-8")).hexdigest()

        # 2. Structural media attributes (file_size, duration, dimensions)
        if file_size or duration or width or height:
            components = [
                str(media_type or "media").lower(),
                str(file_size or 0),
                str(duration or 0),
                f"{width or 0}x{height or 0}",
            ]
            if extra_key:
                components.append(str(extra_key).strip())
            raw = ":".join(components)
            return hashlib.sha256(raw.encode("utf-8")).hexdigest()

        # 3. For pure text messages
        if str(media_type).lower() == "text" and caption and caption.strip():
            raw = f"text:{caption.strip()}"
            return hashlib.sha256(raw.encode("utf-8")).hexdigest()

        # Not enough attributes to safely compute fingerprint without false collision
        return None
