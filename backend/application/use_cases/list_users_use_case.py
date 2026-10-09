from __future__ import annotations

from backend.domain.entities.user import User
from backend.domain.ports.user_repository_port import UserRepositoryPort


class ListUsersUseCase:
    """Lists all users registered in the system."""

    def __init__(self, user_repository: UserRepositoryPort) -> None:
        self.user_repository = user_repository

    async def execute(self) -> list[User]:
        return await self.user_repository.list_users()
