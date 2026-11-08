from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import os
from typing import Any
import asyncpg

from backend.domain.entities.caption_template import CaptionTemplate
from backend.domain.ports.template_repository_port import TemplateRepositoryPort

logger = logging.getLogger(__name__)


class PostgresTemplateRepository(TemplateRepositoryPort):
    """PostgreSQL repository for caption templates with memory fallback."""

    def __init__(self, db_url: str | None = None) -> None:
        self.db_url = db_url or os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@localhost:7902/telegram_hub"
        )
        self.pool: asyncpg.Pool | None = None
        self._fallback_mode = False
        self._memory_templates: dict[str, CaptionTemplate] = {}
        self._initialized = False

    async def connect(self) -> None:
        import asyncio
        current_loop = asyncio.get_running_loop()
        if self.pool is not None:
            if getattr(self.pool, "_loop", None) is not current_loop:
                self.pool = None
            else:
                return
        try:
            self.pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=5, timeout=1.0)
            self._fallback_mode = False
        except Exception as e:
            logger.warning(f"PostgresTemplateRepository: Could not connect to {self.db_url}: {e}. Fallback to memory.")
            self._fallback_mode = True

    async def initialize_schema(self) -> None:
        await self.connect()
        if self._fallback_mode or self.pool is None:
            self._seed_memory_defaults()
            self._initialized = True
            return

        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS caption_templates (
                    id VARCHAR(64) PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
                    name VARCHAR(255) NOT NULL,
                    category VARCHAR(64) NOT NULL DEFAULT 'GENERAL',
                    header TEXT,
                    body_template TEXT NOT NULL,
                    signature TEXT,
                    caption_rules JSONB,
                    is_default BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_caption_templates_tenant ON caption_templates(tenant_id, category);
            """)

            # Seed defaults if empty
            count = await conn.fetchval("SELECT COUNT(*) FROM caption_templates")
            if count == 0:
                await self._seed_db_defaults(conn)

        self._initialized = True

    def _seed_memory_defaults(self) -> None:
        if not self._memory_templates:
            t1 = CaptionTemplate(
                id="tpl_default_vip",
                tenant_id="00000000-0000-0000-0000-000000000001",
                name="Estreno Oficial VIP",
                category="MIGRATION",
                header="🎬 ESTRENO EXCLUSIVO",
                body_template="📹 {title}\n📅 Año: {year}\n📁 Calidad: {quality}\n\n👉 Disfrútalo en nuestro canal oficial.",
                signature="🌟 Canal: {channel}",
                is_default=True,
                created_at=datetime.now(timezone.utc).isoformat(),
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            t2 = CaptionTemplate(
                id="tpl_default_antispam",
                tenant_id="00000000-0000-0000-0000-000000000001",
                name="Sanitizado Anti-Spam",
                category="GENERAL",
                header="✨ CONTENIDO LIMPIO",
                body_template="{title}",
                signature="⚡ Canal Oficial: {channel}",
                caption_rules={"strip_links": True, "strip_all_mentions": True},
                is_default=False,
                created_at=datetime.now(timezone.utc).isoformat(),
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            self._memory_templates[t1.id] = t1
            self._memory_templates[t2.id] = t2

    async def _seed_db_defaults(self, conn: asyncpg.Connection) -> None:
        defaults = [
            (
                "tpl_default_vip",
                "00000000-0000-0000-0000-000000000001",
                "Estreno Oficial VIP",
                "MIGRATION",
                "🎬 ESTRENO EXCLUSIVO",
                "📹 {title}\n📅 Año: {year}\n📁 Calidad: {quality}\n\n👉 Disfrútalo en nuestro canal oficial.",
                "🌟 Canal: {channel}",
                None,
                True,
            ),
            (
                "tpl_default_antispam",
                "00000000-0000-0000-0000-000000000001",
                "Sanitizado Anti-Spam",
                "GENERAL",
                "✨ CONTENIDO LIMPIO",
                "{title}",
                "⚡ Canal Oficial: {channel}",
                json.dumps({"strip_links": True, "strip_all_mentions": True}),
                False,
            ),
        ]
        for d in defaults:
            await conn.execute(
                """
                INSERT INTO caption_templates (
                    id, tenant_id, name, category, header, body_template,
                    signature, caption_rules, is_default
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
                ON CONFLICT (id) DO NOTHING
                """,
                *d,
            )

    async def _ensure_initialized(self) -> None:
        if not self._initialized:
            await self.initialize_schema()

    async def create_template(self, template: CaptionTemplate) -> CaptionTemplate:
        await self._ensure_initialized()
        now_dt = datetime.now(timezone.utc)
        created_dt = datetime.fromisoformat(template.created_at) if template.created_at else now_dt
        updated_dt = datetime.fromisoformat(template.updated_at) if template.updated_at else now_dt
        template.created_at = created_dt.isoformat()
        template.updated_at = updated_dt.isoformat()

        if self._fallback_mode or self.pool is None:
            self._memory_templates[template.id] = template
            return template

        rules_json = json.dumps(template.caption_rules) if template.caption_rules else None
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO caption_templates (
                    id, tenant_id, name, category, header, body_template,
                    signature, caption_rules, is_default, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
                """,
                template.id,
                template.tenant_id,
                template.name,
                template.category,
                template.header,
                template.body_template,
                template.signature,
                rules_json,
                template.is_default,
                created_dt,
                updated_dt,
            )
        return template

    async def get_template(self, template_id: str, tenant_id: str) -> CaptionTemplate | None:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            tpl = self._memory_templates.get(template_id)
            if tpl and (tpl.tenant_id == tenant_id or tpl.tenant_id == "00000000-0000-0000-0000-000000000001"):
                return tpl
            return None

        async with self.pool.acquire() as conn:
            r = await conn.fetchrow(
                """
                SELECT id, tenant_id, name, category, header, body_template,
                       signature, caption_rules, is_default, created_at, updated_at
                FROM caption_templates
                WHERE id = $1 AND (tenant_id = $2 OR tenant_id = '00000000-0000-0000-0000-000000000001')
                """,
                template_id,
                tenant_id,
            )
            if not r:
                return None
            rules = json.loads(r["caption_rules"]) if r["caption_rules"] else None
            return CaptionTemplate(
                id=r["id"],
                tenant_id=r["tenant_id"],
                name=r["name"],
                category=r["category"],
                header=r["header"],
                body_template=r["body_template"],
                signature=r["signature"],
                caption_rules=rules,
                is_default=bool(r["is_default"]),
                created_at=r["created_at"].isoformat() if r["created_at"] else None,
                updated_at=r["updated_at"].isoformat() if r["updated_at"] else None,
            )

    async def list_templates(self, tenant_id: str, category: str | None = None) -> list[CaptionTemplate]:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            results = [
                t for t in self._memory_templates.values()
                if (t.tenant_id == tenant_id or t.tenant_id == "00000000-0000-0000-0000-000000000001")
            ]
            if category:
                results = [t for t in results if t.category.upper() == category.upper()]
            return results

        async with self.pool.acquire() as conn:
            query = """
                SELECT id, tenant_id, name, category, header, body_template,
                       signature, caption_rules, is_default, created_at, updated_at
                FROM caption_templates
                WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000001')
            """
            params: list[Any] = [tenant_id]
            if category:
                params.append(category.upper())
                query += f" AND UPPER(category) = ${len(params)}"

            query += " ORDER BY is_default DESC, name ASC"
            rows = await conn.fetch(query, *params)
            templates = []
            for r in rows:
                rules = json.loads(r["caption_rules"]) if r["caption_rules"] else None
                templates.append(
                    CaptionTemplate(
                        id=r["id"],
                        tenant_id=r["tenant_id"],
                        name=r["name"],
                        category=r["category"],
                        header=r["header"],
                        body_template=r["body_template"],
                        signature=r["signature"],
                        caption_rules=rules,
                        is_default=bool(r["is_default"]),
                        created_at=r["created_at"].isoformat() if r["created_at"] else None,
                        updated_at=r["updated_at"].isoformat() if r["updated_at"] else None,
                    )
                )
            return templates

    async def update_template(self, template: CaptionTemplate) -> CaptionTemplate | None:
        await self._ensure_initialized()
        now_dt = datetime.now(timezone.utc)
        template.updated_at = now_dt.isoformat()

        if self._fallback_mode or self.pool is None:
            if template.id not in self._memory_templates:
                return None
            self._memory_templates[template.id] = template
            return template

        rules_json = json.dumps(template.caption_rules) if template.caption_rules else None
        async with self.pool.acquire() as conn:
            res = await conn.execute(
                """
                UPDATE caption_templates
                SET name = $1, category = $2, header = $3, body_template = $4,
                    signature = $5, caption_rules = $6::jsonb, is_default = $7, updated_at = $8
                WHERE id = $9 AND (tenant_id = $10 OR tenant_id = '00000000-0000-0000-0000-000000000001')
                """,
                template.name,
                template.category,
                template.header,
                template.body_template,
                template.signature,
                rules_json,
                template.is_default,
                now_dt,
                template.id,
                template.tenant_id,
            )
            if res == "UPDATE 0":
                return None
        return template

    async def delete_template(self, template_id: str, tenant_id: str) -> bool:
        await self._ensure_initialized()
        if self._fallback_mode or self.pool is None:
            if template_id in self._memory_templates:
                del self._memory_templates[template_id]
                return True
            return False

        async with self.pool.acquire() as conn:
            res = await conn.execute(
                """
                DELETE FROM caption_templates
                WHERE id = $1 AND (tenant_id = $2 OR tenant_id = '00000000-0000-0000-0000-000000000001')
                """,
                template_id,
                tenant_id,
            )
            return res != "DELETE 0"
