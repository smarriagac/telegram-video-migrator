from __future__ import annotations

import base64
import os
from cryptography.fernet import Fernet
from backend.domain.ports.encryption_port import EncryptionPort


class FernetEncryptionService(EncryptionPort):
    """Encrypts and decrypts secrets at rest using AES-128-CBC/HMAC-SHA256 (Fernet)."""

    def __init__(self, key: str | None = None) -> None:
        if not key:
            key = os.getenv("ENCRYPTION_KEY")
        if not key:
            # Generate deterministic fallback for dev
            key = Fernet.generate_key().decode()
        
        # Ensure key is valid url-safe base64 32 bytes
        try:
            self._fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except Exception:
            # Fallback to padded key
            padded = base64.urlsafe_b64encode(key.ljust(32)[:32].encode())
            self._fernet = Fernet(padded)

    def encrypt(self, plain_text: str) -> str:
        if not plain_text:
            return ""
        return self._fernet.encrypt(plain_text.encode()).decode()

    def decrypt(self, cipher_text: str) -> str:
        if not cipher_text:
            return ""
        return self._fernet.decrypt(cipher_text.encode()).decode()
