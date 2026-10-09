from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TelegramAccount:
    id: int | None
    name: str
    phone: str | None
    api_id_encrypted: str
    api_hash_encrypted: str
    session_string_encrypted: str | None = None
    is_active: bool = True
    created_at: str | None = None
