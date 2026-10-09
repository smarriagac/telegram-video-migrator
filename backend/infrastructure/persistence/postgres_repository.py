from __future__ import annotations

import logging
import os
from typing import Any
import asyncpg

from backend.domain.entities.user import User, Role
from backend.domain.entities.telegram_account import TelegramAccount
from backend.domain.ports.user_repository_port import UserRepositoryPort
from backend.domain.ports.telegram_account_repository_port import TelegramAccountRepositoryPort
from backend.infrastructure.security.password_hasher import PasswordHasher

logger = logging.getLogger(__name__)


class PostgresRepository(UserRepositoryPort, TelegramAccountRepositoryPort):
    """PostgreSQL implementation of User and TelegramAccount repositories with memory fallback for test isolation."""

    def __init__(self, db_url: str | None = None) -> None:
        self.db_url = db_url or os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@localhost:7902/telegram_hub"
        )
        self.pool: asyncpg.Pool | None = None
        # In-memory storage fallback if Postgres server is unavailable (e.g. unit test mode)
        self._fallback_mode = False
        self._users_memory: dict[int, User] = {}
        self._accounts_memory: dict[int, TelegramAccount] = {}
        self._id_counter = 1
        self._seed_memory_admin()

    def _seed_memory_admin(self) -> None:
        if 1 not in self._users_memory:
            admin = User(
                id=1,
                email="admin@telegramhub.local",
                password_hash=PasswordHasher.hash("admin1234"),
                role=Role.ADMIN,
                is_active=True,
            )
            self._users_memory[1] = admin

    async def connect(self) -> None:
        if self.pool is not None:
            return
        try:
            self.pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=10, timeout=1.0)
            self._fallback_mode = False
        except Exception as e:
            logger.warning(f"Could not connect to PostgreSQL at {self.db_url}: {e}. Falling back to memory adapter.")
            self._fallback_mode = True
            self._seed_memory_admin()

    async def initialize_schema(self) -> None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            self._seed_memory_admin()
            return

        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS roles (
                    name VARCHAR(32) PRIMARY KEY,
                    description TEXT
                );

                INSERT INTO roles (name, description) VALUES
                    ('ADMIN', 'Full system and credential control'),
                    ('OPERATOR', 'Video migration and chats access'),
                    ('VIEWER', 'Read-only dashboard view')
                ON CONFLICT (name) DO NOTHING;

                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(32) NOT NULL REFERENCES roles(name),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS telegram_accounts (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(128) NOT NULL,
                    phone VARCHAR(64),
                    api_id_encrypted TEXT NOT NULL,
                    api_hash_encrypted TEXT NOT NULL,
                    session_string_encrypted TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)

            # Seed default admin if table is empty
            admin_row = await conn.fetchrow("SELECT id FROM users WHERE email = $1", "admin@telegramhub.local")
            if not admin_row:
                await conn.execute(
                    """
                    INSERT INTO users (email, password_hash, role, is_active)
                    VALUES ($1, $2, $3, $4)
                    """,
                    "admin@telegramhub.local",
                    PasswordHasher.hash("admin1234"),
                    "ADMIN",
                    True,
                )
                logger.info("Default administrator seeded: admin@telegramhub.local / admin1234")

    async def get_by_email(self, email: str) -> User | None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            for u in self._users_memory.values():
                if u.email.lower() == email.lower():
                    return u
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1",
                email.lower(),
            )
            if not row:
                return None
            return User(
                id=row["id"],
                email=row["email"],
                password_hash=row["password_hash"],
                role=Role(row["role"]),
                is_active=row["is_active"],
            )

    async def get_by_id(self, user_id: int) -> User | None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            return self._users_memory.get(user_id)

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, email, password_hash, role, is_active FROM users WHERE id = $1",
                user_id,
            )
            if not row:
                return None
            return User(
                id=row["id"],
                email=row["email"],
                password_hash=row["password_hash"],
                role=Role(row["role"]),
                is_active=row["is_active"],
            )

    async def create_user(self, user: User) -> User:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            self._id_counter += 1
            user.id = self._id_counter
            self._users_memory[user.id] = user
            return user

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO users (email, password_hash, role, is_active)
                VALUES ($1, $2, $3, $4)
                RETURNING id, created_at
                """,
                user.email.lower(),
                user.password_hash,
                user.role.value,
                user.is_active,
            )
            user.id = row["id"]
            user.created_at = str(row["created_at"])
            return user

    async def list_users(self) -> list[User]:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            return list(self._users_memory.values())

        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, email, password_hash, role, is_active FROM users")
            return [
                User(
                    id=r["id"],
                    email=r["email"],
                    password_hash=r["password_hash"],
                    role=Role(r["role"]),
                    is_active=r["is_active"],
                )
                for r in rows
            ]

    async def save_account(self, account: TelegramAccount) -> TelegramAccount:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            self._id_counter += 1
            account.id = self._id_counter
            for acc in self._accounts_memory.values():
                acc.is_active = False
            self._accounts_memory[account.id] = account
            return account

        async with self.pool.acquire() as conn:
            if account.is_active:
                await conn.execute("UPDATE telegram_accounts SET is_active = FALSE")

            row = await conn.fetchrow(
                """
                INSERT INTO telegram_accounts (name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, created_at
                """,
                account.name,
                account.phone,
                account.api_id_encrypted,
                account.api_hash_encrypted,
                account.session_string_encrypted,
                account.is_active,
            )
            account.id = row["id"]
            account.created_at = str(row["created_at"])
            return account

    async def get_active_account(self) -> TelegramAccount | None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            for acc in self._accounts_memory.values():
                if acc.is_active:
                    return acc
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active
                FROM telegram_accounts
                WHERE is_active = TRUE
                ORDER BY id DESC LIMIT 1
                """
            )
            if not row:
                return None
            return TelegramAccount(
                id=row["id"],
                name=row["name"],
                phone=row["phone"],
                api_id_encrypted=row["api_id_encrypted"],
                api_hash_encrypted=row["api_hash_encrypted"],
                session_string_encrypted=row["session_string_encrypted"],
                is_active=row["is_active"],
            )

    async def list_accounts(self) -> list[TelegramAccount]:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            return list(self._accounts_memory.values())

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active
                FROM telegram_accounts
                ORDER BY id DESC
                """
            )
            return [
                TelegramAccount(
                    id=r["id"],
                    name=r["name"],
                    phone=r["phone"],
                    api_id_encrypted=r["api_id_encrypted"],
                    api_hash_encrypted=r["api_hash_encrypted"],
                    session_string_encrypted=r["session_string_encrypted"],
                    is_active=r["is_active"],
                )
                for r in rows
            ]
