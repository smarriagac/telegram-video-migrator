from __future__ import annotations

from dataclasses import dataclass
from backend.domain.exceptions.domain_exceptions import AccountNotFoundException
from backend.domain.ports.telegram_account_repository_port import TelegramAccountRepositoryPort
from backend.domain.ports.encryption_port import EncryptionPort


@dataclass
class DecryptedCredentials:
    id: int
    name: str
    phone: str | None
    api_id: str
    api_hash: str
    session_string: str | None


class GetActiveTelegramCredentialsUseCase:
    """Retrieves active account and decrypts credentials in-memory for MTProto connection."""

    def __init__(
        self,
        account_repository: TelegramAccountRepositoryPort,
        encryption_service: EncryptionPort,
    ) -> None:
        self.account_repository = account_repository
        self.encryption_service = encryption_service

    async def execute(self) -> DecryptedCredentials:
        account = await self.account_repository.get_active_account()
        if not account:
            raise AccountNotFoundException("No active Telegram account found.")

        dec_api_id = self.encryption_service.decrypt(account.api_id_encrypted)
        dec_api_hash = self.encryption_service.decrypt(account.api_hash_encrypted)
        dec_session = (
            self.encryption_service.decrypt(account.session_string_encrypted)
            if account.session_string_encrypted
            else None
        )

        return DecryptedCredentials(
            id=account.id or 1,
            name=account.name,
            phone=account.phone,
            api_id=dec_api_id,
            api_hash=dec_api_hash,
            session_string=dec_session,
        )
