from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from backend.domain.entities.user import User, Role
from backend.domain.exceptions.domain_exceptions import InvalidCredentialsException
from backend.infrastructure.security.fernet_encryption_service import FernetEncryptionService
from backend.infrastructure.security.jwt_token_service import JwtTokenService
from backend.infrastructure.security.password_hasher import PasswordHasher
from backend.infrastructure.persistence.postgres_repository import PostgresRepository
from backend.application.use_cases.authenticate_user_use_case import AuthenticateUserUseCase
from backend.application.use_cases.save_telegram_credentials_use_case import SaveTelegramCredentialsUseCase
from backend.application.use_cases.get_active_telegram_credentials_use_case import GetActiveTelegramCredentialsUseCase
from backend.main import app


def test_encryption_roundtrip():
    service = FernetEncryptionService()
    secret = "my_telegram_api_hash_12345"
    token = service.encrypt(secret)
    assert token != secret
    assert service.decrypt(token) == secret


def test_password_hasher():
    raw = "super_secret_password"
    hashed = PasswordHasher.hash(raw)
    assert hashed != raw
    assert PasswordHasher.verify(raw, hashed)
    assert not PasswordHasher.verify("wrong_password", hashed)


def test_jwt_token_service():
    service = JwtTokenService(secret_key="test_key_1234567890_32bytes_long!")
    token = service.create_access_token({"sub": "1", "role": "ADMIN"})
    payload = service.decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "1"
    assert payload["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_authenticate_user_use_case():
    repo = PostgresRepository()
    await repo.initialize_schema()
    token_svc = JwtTokenService()
    use_case = AuthenticateUserUseCase(user_repository=repo, token_service=token_svc)

    # Success with seeded admin
    result = await use_case.execute("admin@telegramhub.local", "admin1234")
    assert "access_token" in result
    assert result["user"]["email"] == "admin@telegramhub.local"
    assert result["user"]["role"] == "ADMIN"

    # Fail with wrong password
    with pytest.raises(InvalidCredentialsException):
        await use_case.execute("admin@telegramhub.local", "wrongpass")


@pytest.mark.asyncio
async def test_telegram_credentials_encryption_use_cases():
    repo = PostgresRepository()
    await repo.initialize_schema()
    enc_svc = FernetEncryptionService()

    save_uc = SaveTelegramCredentialsUseCase(account_repository=repo, encryption_service=enc_svc)
    get_uc = GetActiveTelegramCredentialsUseCase(account_repository=repo, encryption_service=enc_svc)

    await save_uc.execute(
        name="Producción",
        api_id="987654",
        api_hash="hash_secret_abcdef",
        phone="+1234567890",
        session_string="session_blob_xyz",
    )

    decrypted = await get_uc.execute()
    assert decrypted.name == "Producción"
    assert decrypted.api_id == "987654"
    assert decrypted.api_hash == "hash_secret_abcdef"
    assert decrypted.session_string == "session_blob_xyz"


@pytest.mark.asyncio
async def test_api_auth_and_rbac_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login with seeded admin
        login_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@telegramhub.local", "password": "admin1234"},
        )
        assert login_res.status_code == 200
        token_data = login_res.json()
        token = token_data["access_token"]
        assert token_data["user"]["role"] == "ADMIN"

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get /api/auth/me
        me_res = await client.get("/api/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "admin@telegramhub.local"

        # 3. Save Telegram Credentials as ADMIN
        save_res = await client.post(
            "/api/settings/credentials",
            headers=headers,
            json={
                "name": "Cuenta Principal",
                "api_id": "112233",
                "api_hash": "aabbccddeeff0011223344",
            },
        )
        assert save_res.status_code == 201
        assert "api_id_masked" in save_res.json()

        # 4. Attempt to save credentials without token (401)
        unauth_res = await client.post(
            "/api/settings/credentials",
            json={"name": "Fail", "api_id": "1", "api_hash": "2"},
        )
        assert unauth_res.status_code == 401
