from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from backend.domain.entities.user import User, Role
from backend.domain.exceptions.domain_exceptions import DomainException, UserNotFoundException
from backend.infrastructure.persistence.postgres_repository import PostgresRepository
from backend.application.use_cases.list_users_use_case import ListUsersUseCase
from backend.application.use_cases.update_user_use_case import UpdateUserUseCase
from backend.main import app


@pytest.mark.asyncio
async def test_list_and_update_user_use_cases():
    repo = PostgresRepository()
    await repo.initialize_schema()

    list_uc = ListUsersUseCase(user_repository=repo)
    update_uc = UpdateUserUseCase(user_repository=repo)

    users = await list_uc.execute()
    assert len(users) >= 1
    admin_user = users[0]

    unique_email = f"test_op_{uuid.uuid4().hex[:6]}@hub.local"
    new_user = await repo.create_user(
        User(
            id=None,
            email=unique_email,
            password_hash="fakehash",
            role=Role.OPERATOR,
            is_active=True,
        )
    )

    # Admin promotes operator to ADMIN
    updated = await update_uc.execute(
        current_admin_id=admin_user.id or 1,
        target_user_id=new_user.id or 2,
        role=Role.ADMIN,
    )
    assert updated.role == Role.ADMIN

    # Admin self-deactivation attempt must fail
    with pytest.raises(DomainException):
        await update_uc.execute(
            current_admin_id=admin_user.id or 1,
            target_user_id=admin_user.id or 1,
            is_active=False,
        )

    # Updating non-existent user fails
    with pytest.raises(UserNotFoundException):
        await update_uc.execute(
            current_admin_id=admin_user.id or 1,
            target_user_id=999999,
            role=Role.VIEWER,
        )


@pytest.mark.asyncio
async def test_api_user_management_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as admin
        login_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@telegramhub.local", "password": "admin1234"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create new operator with unique email
        op_email = f"nuevo_operador_{uuid.uuid4().hex[:6]}@telegramhub.local"
        create_res = await client.post(
            "/api/auth/users",
            headers=headers,
            json={
                "email": op_email,
                "password": "operadorpassword123",
                "role": "OPERATOR",
            },
        )
        assert create_res.status_code == 201
        created_id = create_res.json()["id"]

        # List users
        list_res = await client.get("/api/auth/users", headers=headers)
        assert list_res.status_code == 200
        user_list = list_res.json()
        assert len(user_list) >= 2

        # Update operator to VIEWER
        patch_res = await client.patch(
            f"/api/auth/users/{created_id}",
            headers=headers,
            json={"role": "VIEWER"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["role"] == "VIEWER"

        # Attempt to self-deactivate admin (ID 1)
        self_deact_res = await client.patch(
            "/api/auth/users/1",
            headers=headers,
            json={"is_active": False},
        )
        assert self_deact_res.status_code == 400
