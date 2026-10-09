from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
import jwt
from backend.domain.ports.token_service_port import TokenServicePort


class JwtTokenService(TokenServicePort):
    """Generates and verifies JWT tokens using PyJWT."""

    def __init__(self, secret_key: str | None = None, expiration_minutes: int = 1440) -> None:
        self.secret_key = secret_key or os.getenv(
            "JWT_SECRET_KEY", "telegramhub_secret_jwt_key_2026_super_safe_32_bytes"
        )
        self.expiration_minutes = expiration_minutes
        self.algorithm = "HS256"

    def create_access_token(self, payload: dict) -> str:
        to_encode = payload.copy()
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=self.expiration_minutes)
        to_encode.update({"exp": expire, "iat": now})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def decode_access_token(self, token: str) -> dict | None:
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        except jwt.PyJWTError:
            return None
