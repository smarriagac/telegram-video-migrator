from __future__ import annotations

from abc import ABC, abstractmethod


class EncryptionPort(ABC):
    @abstractmethod
    def encrypt(self, plain_text: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def decrypt(self, cipher_text: str) -> str:
        raise NotImplementedError
