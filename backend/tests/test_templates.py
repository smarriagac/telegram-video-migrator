from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from backend.domain.entities.caption_template import CaptionTemplate
from backend.application.services.template_service import TemplateService
from backend.infrastructure.persistence.postgres_template_repository import PostgresTemplateRepository
from backend.main import app


def test_template_service_interpolation_and_rules():
    service = TemplateService()
    tpl = CaptionTemplate(
        name="Test Template",
        header="🎬 ESTRENO",
        body_template="Título: {title}\nCanal: {channel}\nAño: {year}\nEnlace spam: https://t.me/spam_link",
        signature="🌟 Síguenos en @canal_viejo",
        caption_rules={
            "strip_links": True,
            "replace_mentions": {"@canal_viejo": "@canal_nuevo"},
        },
    )

    rendered = service.render_template(
        template=tpl,
        context={"title": "Matrix Resurrections", "channel": "@SciFiHub", "year": "2026"},
        apply_rules=True,
    )

    assert "🎬 ESTRENO" in rendered
    assert "Título: Matrix Resurrections" in rendered
    assert "Canal: @SciFiHub" in rendered
    assert "Año: 2026" in rendered
    assert "https://t.me/spam_link" not in rendered  # stripped
    assert "@canal_nuevo" in rendered  # replaced mention
    assert "@canal_viejo" not in rendered


@pytest.mark.asyncio
async def test_postgres_template_repository_crud():
    repo = PostgresTemplateRepository()
    await repo.initialize_schema()

    tenant_id = "00000000-0000-0000-0000-000000000001"

    # 1. Defaults should be seeded
    defaults = await repo.list_templates(tenant_id=tenant_id)
    assert len(defaults) >= 2

    # 2. Create custom template
    new_tpl = CaptionTemplate(
        id="tpl_custom_promo",
        tenant_id=tenant_id,
        name="Fin de Semana",
        category="BROADCAST",
        body_template="¡Gran descuento este fin de semana en {channel}!",
    )
    created = await repo.create_template(new_tpl)
    assert created.id == "tpl_custom_promo"

    # 3. Get template
    fetched = await repo.get_template(template_id="tpl_custom_promo", tenant_id=tenant_id)
    assert fetched is not None
    assert fetched.name == "Fin de Semana"

    # 4. Update template
    fetched.name = "Fin de Semana VIP"
    updated = await repo.update_template(fetched)
    assert updated is not None
    assert updated.name == "Fin de Semana VIP"

    # 5. List with category filter
    broadcast_list = await repo.list_templates(tenant_id=tenant_id, category="BROADCAST")
    assert any(t.id == "tpl_custom_promo" for t in broadcast_list)

    # 6. Delete template
    deleted = await repo.delete_template(template_id="tpl_custom_promo", tenant_id=tenant_id)
    assert deleted is True

    # 7. Verify deletion
    after_del = await repo.get_template(template_id="tpl_custom_promo", tenant_id=tenant_id)
    assert after_del is None


@pytest.mark.asyncio
async def test_templates_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request fails with 401
        unauth = await client.get("/api/templates")
        assert unauth.status_code == 401

        # 2. Login as admin
        login_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@telegramhub.local", "password": "admin1234"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. List templates
        list_res = await client.get("/api/templates", headers=headers)
        assert list_res.status_code == 200
        templates = list_res.json()
        assert len(templates) >= 2

        # 4. Create new template
        create_res = await client.post(
            "/api/templates",
            json={
                "name": "Plantilla API Test",
                "body_template": "Video: {title}\nCanal: {channel}",
                "category": "MIGRATION",
                "header": "🔥 NUEVO",
            },
            headers=headers,
        )
        assert create_res.status_code == 201
        tpl_data = create_res.json()
        template_id = tpl_data["id"]

        # 5. Get created template
        get_res = await client.get(f"/api/templates/{template_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "Plantilla API Test"

        # 6. Render saved template with context
        render_res = await client.post(
            f"/api/templates/{template_id}/render",
            json={"context": {"title": "Avatar 3", "channel": "@PeliculasHD"}},
            headers=headers,
        )
        assert render_res.status_code == 200
        render_data = render_res.json()
        assert "🔥 NUEVO" in render_data["rendered_caption"]
        assert "Video: Avatar 3" in render_data["rendered_caption"]
        assert "Canal: @PeliculasHD" in render_data["rendered_caption"]

        # 7. Preview ad-hoc template
        prev_res = await client.post(
            "/api/templates/preview/render",
            json={
                "body_template": "Avance: {title} en {date}",
                "context": {"title": "Dune 3"},
            },
            headers=headers,
        )
        assert prev_res.status_code == 200
        assert "Avance: Dune 3 en" in prev_res.json()["rendered_caption"]

        # 8. Delete template
        del_res = await client.delete(f"/api/templates/{template_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True
