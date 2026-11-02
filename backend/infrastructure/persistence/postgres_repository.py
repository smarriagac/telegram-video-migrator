from __future__ import annotations

import logging
import os
import uuid
from typing import Any
import asyncpg

from backend.domain.entities.user import User, Role
from backend.domain.entities.telegram_account import TelegramAccount
from backend.domain.entities.audit_log import AuditLog
from backend.domain.ports.user_repository_port import UserRepositoryPort
from backend.domain.ports.telegram_account_repository_port import TelegramAccountRepositoryPort
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.infrastructure.security.password_hasher import PasswordHasher

logger = logging.getLogger(__name__)


class PostgresRepository(UserRepositoryPort, TelegramAccountRepositoryPort, AuditRepositoryPort):
    """PostgreSQL implementation of User, TelegramAccount, and Audit repositories with memory fallback."""

    def __init__(self, db_url: str | None = None) -> None:
        self.db_url = db_url or os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@localhost:7902/telegram_hub"
        )
        self.pool: asyncpg.Pool | None = None
        # In-memory storage fallback if Postgres server is unavailable (e.g. unit test mode)
        self._fallback_mode = False
        self._users_memory: dict[int, User] = {}
        self._accounts_memory: dict[int, TelegramAccount] = {}
        self._audit_logs_memory: list[AuditLog] = []
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
        import asyncio
        current_loop = asyncio.get_running_loop()
        if self.pool is not None:
            if getattr(self.pool, "_loop", None) is not current_loop:
                self.pool = None
            else:
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

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    user_email VARCHAR(255),
                    action VARCHAR(64) NOT NULL,
                    resource VARCHAR(128),
                    details JSONB,
                    ip_address VARCHAR(64),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

                ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID;
                ALTER TABLE telegram_accounts ADD COLUMN IF NOT EXISTS tenant_id UUID;
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

            # Seed active Telegram account from environment if telegram_accounts is empty
            accounts_count = await conn.fetchval("SELECT count(*) FROM telegram_accounts")
            if accounts_count == 0:
                api_id = os.getenv("TELEGRAM_API_ID")
                api_hash = os.getenv("TELEGRAM_API_HASH")
                session_str = os.getenv("TELEGRAM_SESSION_STRING")
                if api_id and api_hash:
                    from backend.infrastructure.security.fernet_encryption_service import FernetEncryptionService
                    enc_svc = FernetEncryptionService()
                    await conn.execute(
                        """
                        INSERT INTO telegram_accounts (name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        """,
                        "Cuenta Principal",
                        None,
                        enc_svc.encrypt(api_id),
                        enc_svc.encrypt(api_hash),
                        enc_svc.encrypt(session_str) if session_str else None,
                        True,
                    )
                    logger.info("Active environment Telegram account seeded into PostgreSQL.")

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

    async def update_user(
        self, user_id: int, role: Role | None = None, is_active: bool | None = None
    ) -> User | None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            user = self._users_memory.get(user_id)
            if not user:
                return None
            if role is not None:
                user.role = role
            if is_active is not None:
                user.is_active = is_active
            return user

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE users
                SET role = COALESCE($1, role),
                    is_active = COALESCE($2, is_active)
                WHERE id = $3
                RETURNING id, email, password_hash, role, is_active
                """,
                role.value if role else None,
                is_active,
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

    async def delete_user(self, user_id: int) -> bool:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            if user_id in self._users_memory:
                del self._users_memory[user_id]
                return True
            return False

        async with self.pool.acquire() as conn:
            res = await conn.execute("DELETE FROM users WHERE id = $1", user_id)
            return "DELETE 1" in res

    async def save_account(self, account: TelegramAccount) -> TelegramAccount:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            self._id_counter += 1
            account.id = self._id_counter
            self._accounts_memory[account.id] = account
            return account

        async with self.pool.acquire() as conn:
            tenant_uuid = uuid.UUID(account.tenant_id) if account.tenant_id else None
            row = await conn.fetchrow(
                """
                INSERT INTO telegram_accounts (name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, created_at
                """,
                account.name,
                account.phone,
                account.api_id_encrypted,
                account.api_hash_encrypted,
                account.session_string_encrypted,
                account.is_active,
                tenant_uuid,
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
                SELECT id, name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active, tenant_id, created_at
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
                tenant_id=str(row["tenant_id"]) if ("tenant_id" in row and row["tenant_id"]) else None,
                created_at=str(row["created_at"]) if row["created_at"] else None,
            )

    async def get_account_by_id(self, account_id: int) -> TelegramAccount | None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            return self._accounts_memory.get(account_id)

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active, tenant_id, created_at
                FROM telegram_accounts
                WHERE id = $1
                """,
                account_id,
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
                tenant_id=str(row["tenant_id"]) if ("tenant_id" in row and row["tenant_id"]) else None,
                created_at=str(row["created_at"]) if row["created_at"] else None,
            )

    async def list_active_accounts(self) -> list[TelegramAccount]:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            return [acc for acc in self._accounts_memory.values() if acc.is_active]

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active, tenant_id, created_at
                FROM telegram_accounts
                WHERE is_active = TRUE
                ORDER BY id ASC
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
                    tenant_id=str(r["tenant_id"]) if ("tenant_id" in r and r["tenant_id"]) else None,
                    created_at=str(r["created_at"]) if r["created_at"] else None,
                )
                for r in rows
            ]

    async def list_accounts(self) -> list[TelegramAccount]:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            return list(self._accounts_memory.values())

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, name, phone, api_id_encrypted, api_hash_encrypted, session_string_encrypted, is_active, tenant_id, created_at
                FROM telegram_accounts
                ORDER BY id ASC
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
                    tenant_id=str(r["tenant_id"]) if ("tenant_id" in r and r["tenant_id"]) else None,
                    created_at=str(r["created_at"]) if r["created_at"] else None,
                )
                for r in rows
            ]

    async def delete_account(self, account_id: int) -> bool:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            return self._accounts_memory.pop(account_id, None) is not None

        async with self.pool.acquire() as conn:
            res = await conn.execute("DELETE FROM telegram_accounts WHERE id = $1", account_id)
            return res.endswith("1")

    async def record_audit_log(self, log: AuditLog) -> AuditLog:
        import json
        import datetime
        await self.connect()
        if self._fallback_mode or self.pool is None:
            log.id = len(self._audit_logs_memory) + 1
            log.created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self._audit_logs_memory.append(log)
            return log

        async with self.pool.acquire() as conn:
            details_json = json.dumps(log.details) if log.details is not None else None
            row = await conn.fetchrow(
                """
                INSERT INTO audit_logs (user_id, user_email, action, resource, details, ip_address)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, created_at;
                """,
                log.user_id,
                log.user_email,
                log.action,
                log.resource,
                details_json,
                log.ip_address,
            )
            log.id = row["id"]
            log.created_at = str(row["created_at"])
            return log

    async def list_audit_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        action: str | None = None,
        user_email: str | None = None,
    ) -> list[AuditLog]:
        import json
        await self.connect()
        if self._fallback_mode or self.pool is None:
            results = list(self._audit_logs_memory)
            if action:
                results = [r for r in results if r.action.lower() == action.lower()]
            if user_email:
                results = [r for r in results if r.user_email and user_email.lower() in r.user_email.lower()]
            results.reverse()
            return results[offset : offset + limit]

        async with self.pool.acquire() as conn:
            query = """
                SELECT id, user_id, user_email, action, resource, details, ip_address, created_at
                FROM audit_logs
                WHERE 1=1
            """
            params: list[Any] = []
            if action:
                params.append(action.upper())
                query += f" AND action = ${len(params)}"
            if user_email:
                params.append(f"%{user_email.lower()}%")
                query += f" AND LOWER(user_email) LIKE ${len(params)}"

            params.append(limit)
            query += f" ORDER BY created_at DESC LIMIT ${len(params)}"
            params.append(offset)
            query += f" OFFSET ${len(params)}"

            rows = await conn.fetch(query, *params)
            audit_logs = []
            for r in rows:
                details = None
                if r["details"]:
                    details = json.loads(r["details"]) if isinstance(r["details"], str) else dict(r["details"])
                audit_logs.append(
                    AuditLog(
                        id=r["id"],
                        user_id=r["user_id"],
                        user_email=r["user_email"],
                        action=r["action"],
                        resource=r["resource"],
                        details=details,
                        ip_address=r["ip_address"],
                        created_at=str(r["created_at"]) if r["created_at"] else None,
                    )
                )
            return audit_logs

    async def count_audit_logs(
        self,
        action: str | None = None,
        user_email: str | None = None,
    ) -> int:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            results = list(self._audit_logs_memory)
            if action:
                results = [r for r in results if r.action.lower() == action.lower()]
            if user_email:
                results = [r for r in results if r.user_email and user_email.lower() in r.user_email.lower()]
            return len(results)

        async with self.pool.acquire() as conn:
            query = "SELECT count(*) FROM audit_logs WHERE 1=1"
            params: list[Any] = []
            if action:
                params.append(action.upper())
                query += f" AND action = ${len(params)}"
            if user_email:
                params.append(f"%{user_email.lower()}%")
                query += f" AND LOWER(user_email) LIKE ${len(params)}"

            return await conn.fetchval(query, *params)


