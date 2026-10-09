from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Role(str, Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


@dataclass
class User:
    id: int | None
    email: str
    password_hash: str
    role: Role
    is_active: bool = True
    created_at: str | None = None
