from __future__ import annotations

from backend.domain.exceptions.domain_exceptions import InvalidCredentialsException
from backend.domain.ports.user_repository_port import UserRepositoryPort
from backend.domain.ports.token_service_port import TokenServicePort
from backend.infrastructure.security.password_hasher import PasswordHasher


class AuthenticateUserUseCase:
    """Authenticates a user and generates an access JWT token."""

    def __init__(
        self,
        user_repository: UserRepositoryPort,
        token_service: TokenServicePort,
    ) -> None:
        self.user_repository = user_repository
        self.token_service = token_service

    async def execute(self, email: str, password: str) -> dict:
        user = await self.user_repository.get_by_email(email)
        if not user or not user.is_active:
            raise InvalidCredentialsException("Credenciales inválidas.")

        if not PasswordHasher.verify(password, user.password_hash):
            raise InvalidCredentialsException("Credenciales inválidas.")

        token = self.token_service.create_access_token(
            {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role.value,
            }
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role.value,
            },
        }
