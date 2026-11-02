from __future__ import annotations

import asyncio
import pytest
from backend.infrastructure.persistence.postgres_repository import PostgresRepository


@pytest.fixture(autouse=True)
def clean_database_after_each_test():
    """Ensure no test accounts or users pollute the database across test runs."""
    yield
    async def _clean():
        repo = PostgresRepository()
        try:
            await repo.connect()
            if repo.pool:
                async with repo.pool.acquire() as conn:
                    await conn.execute(
                        "DELETE FROM users WHERE id > 1 AND (email LIKE 'test_%' OR email LIKE 'nuevo_operador_%');"
                    )
                    await conn.execute(
                        "DELETE FROM telegram_accounts WHERE id > 1 AND (name = 'Producción' OR name LIKE 'Cuenta Test%');"
                    )
                    await conn.execute("DELETE FROM audit_logs WHERE action = 'TEST_ACTION';")
        except Exception:
            pass
        finally:
            await repo.disconnect()

    try:
        asyncio.run(_clean())
    except Exception:
        pass
