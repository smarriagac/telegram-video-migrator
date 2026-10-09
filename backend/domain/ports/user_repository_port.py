from __future__ import annotations

from abc import ABC, abstractmethod
from backend.domain.entities.user import User, Role


class UserRepositoryPort(ABC):
    @abstractmethod
    async def get_by_email(self, email: str) -> User | None:
        raise NotImplementedError

    @abstractmethod
    async def get_by_id(self, user_id: int) -> User | None:
        raise NotImplementedError

    @abstractmethod
    async def create_user(self, user: User) -> User:
        raise NotImplementedError

    @abstractmethod
    async def list_users(self) -> list[User]:
        raise NotImplementedError

    @abstractmethod
    async def update_user(
        self, user_id: int, role: Role | None = None, is_active: bool | None = None
    ) -> User | None:
        raise NotImplementedError
