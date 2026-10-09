from __future__ import annotations

from backend.domain.entities.telegram_account import TelegramAccount
from backend.domain.ports.telegram_account_repository_port import TelegramAccountRepositoryPort
from backend.domain.ports.encryption_port import EncryptionPort


class SaveTelegramCredentialsUseCase:
    """Encrypts Telegram credentials at rest and persists them."""

    def __init__(
        self,
        account_repository: TelegramAccountRepositoryPort,
        encryption_service: EncryptionPort,
    ) -> None:
        self.account_repository = account_repository
        self.encryption_service = encryption_service

    async def execute(
        self,
        name: str,
        api_id: str,
        api_hash: str,
        phone: str | None = None,
        session_string: str | None = None,
    ) -> TelegramAccount:
        enc_api_id = self.encryption_service.encrypt(str(api_id).strip())
        enc_api_hash = self.encryption_service.encrypt(api_hash.strip())
        enc_session = (
            self.encryption_service.encrypt(session_string.strip())
            if session_string
            else None
        )

        account = TelegramAccount(
            id=None,
            name=name,
            phone=phone,
            api_id_encrypted=enc_api_id,
            api_hash_encrypted=enc_api_hash,
            session_string_encrypted=enc_session,
            is_active=True,
        )

        return await self.account_repository.save_account(account)
