from __future__ import annotations

from abc import ABC, abstractmethod


class TokenServicePort(ABC):
    @abstractmethod
    def create_access_token(self, payload: dict) -> str:
        raise NotImplementedError

    @abstractmethod
    def decode_access_token(self, token: str) -> dict | None:
        raise NotImplementedError
