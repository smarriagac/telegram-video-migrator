from __future__ import annotations

from backend.domain.entities.user import User, Role
from backend.domain.exceptions.domain_exceptions import UserNotFoundException, DomainException
from backend.domain.ports.user_repository_port import UserRepositoryPort


class UpdateUserUseCase:
    """Updates user role or active status with safety checks against self-deactivation."""

    def __init__(self, user_repository: UserRepositoryPort) -> None:
        self.user_repository = user_repository

    async def execute(
        self,
        current_admin_id: int,
        target_user_id: int,
        role: Role | None = None,
        is_active: bool | None = None,
    ) -> User:
        if current_admin_id == target_user_id and is_active is False:
            raise DomainException("Un administrador no puede desactivar su propia cuenta.")

        updated = await self.user_repository.update_user(
            user_id=target_user_id, role=role, is_active=is_active
        )
        if not updated:
            raise UserNotFoundException(f"Usuario {target_user_id} no encontrado.")

        return updated
