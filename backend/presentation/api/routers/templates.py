from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.domain.entities.caption_template import CaptionTemplate
from backend.domain.entities.user import User
from backend.domain.ports.template_repository_port import TemplateRepositoryPort
from backend.application.services.template_service import TemplateService
from backend.presentation.dependencies import (
    get_current_user,
    get_template_repository,
    get_template_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/templates", tags=["Caption & Message Templates"])


class CreateTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    body_template: str = Field(..., description="Message body with optional {tokens}")
    category: str = Field(default="GENERAL", description="MIGRATION, BROADCAST, WATERMARK, or GENERAL")
    header: str | None = None
    signature: str | None = None
    caption_rules: dict[str, Any] | None = None
    is_default: bool = False


class UpdateTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    body_template: str
    category: str = "GENERAL"
    header: str | None = None
    signature: str | None = None
    caption_rules: dict[str, Any] | None = None
    is_default: bool = False


class RenderTemplateRequest(BaseModel):
    context: dict[str, Any] = Field(default_factory=dict)
    apply_rules: bool = True


class PreviewTemplateRequest(BaseModel):
    body_template: str
    header: str | None = None
    signature: str | None = None
    caption_rules: dict[str, Any] | None = None
    context: dict[str, Any] = Field(default_factory=dict)
    apply_rules: bool = True


@router.get("")
async def list_templates(
    category: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    repo: TemplateRepositoryPort = Depends(get_template_repository),
) -> list[dict[str, Any]]:
    """Lists reusable caption and broadcast message templates for the active tenant."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    templates = await repo.list_templates(tenant_id=tenant_id, category=category)
    return [t.to_dict() for t in templates]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    repo: TemplateRepositoryPort = Depends(get_template_repository),
) -> dict[str, Any]:
    """Creates a new caption or message template."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    tpl = CaptionTemplate(
        name=payload.name,
        body_template=payload.body_template,
        tenant_id=tenant_id,
        category=payload.category,
        header=payload.header,
        signature=payload.signature,
        caption_rules=payload.caption_rules,
        is_default=payload.is_default,
    )
    saved = await repo.create_template(tpl)
    return saved.to_dict()


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    repo: TemplateRepositoryPort = Depends(get_template_repository),
) -> dict[str, Any]:
    """Retrieves a specific caption template."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    tpl = await repo.get_template(template_id=template_id, tenant_id=tenant_id)
    if not tpl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plantilla '{template_id}' no encontrada.",
        )
    return tpl.to_dict()


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    payload: UpdateTemplateRequest,
    current_user: User = Depends(get_current_user),
    repo: TemplateRepositoryPort = Depends(get_template_repository),
) -> dict[str, Any]:
    """Updates an existing caption template."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    existing = await repo.get_template(template_id=template_id, tenant_id=tenant_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plantilla '{template_id}' no encontrada.",
        )

    existing.name = payload.name
    existing.body_template = payload.body_template
    existing.category = payload.category
    existing.header = payload.header
    existing.signature = payload.signature
    existing.caption_rules = payload.caption_rules
    existing.is_default = payload.is_default

    updated = await repo.update_template(existing)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se pudo actualizar la plantilla.")
    return updated.to_dict()


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    repo: TemplateRepositoryPort = Depends(get_template_repository),
) -> dict[str, Any]:
    """Permanently purges a caption template."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    deleted = await repo.delete_template(template_id=template_id, tenant_id=tenant_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plantilla '{template_id}' no encontrada.",
        )
    return {"success": True, "deleted_template_id": template_id}


@router.post("/preview/render")
async def preview_custom_template(
    payload: PreviewTemplateRequest,
    current_user: User = Depends(get_current_user),
    service: TemplateService = Depends(get_template_service),
) -> dict[str, Any]:
    """Simulates dynamic token rendering on-the-fly for unsaved templates."""
    temp_tpl = CaptionTemplate(
        name="Ad-Hoc Preview",
        body_template=payload.body_template,
        header=payload.header,
        signature=payload.signature,
        caption_rules=payload.caption_rules,
    )
    rendered = service.render_template(
        template=temp_tpl,
        context=payload.context,
        apply_rules=payload.apply_rules,
    )
    return {
        "success": True,
        "rendered_caption": rendered,
        "context_applied": service.build_default_context(payload.context),
    }


@router.post("/{template_id}/render")
async def render_saved_template(
    template_id: str,
    payload: RenderTemplateRequest = RenderTemplateRequest(),
    current_user: User = Depends(get_current_user),
    repo: TemplateRepositoryPort = Depends(get_template_repository),
    service: TemplateService = Depends(get_template_service),
) -> dict[str, Any]:
    """Interpolates variables and sanitization rules into a saved template."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    tpl = await repo.get_template(template_id=template_id, tenant_id=tenant_id)
    if not tpl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plantilla '{template_id}' no encontrada.",
        )

    rendered = service.render_template(
        template=tpl,
        context=payload.context,
        apply_rules=payload.apply_rules,
    )
    return {
        "success": True,
        "template_id": template_id,
        "template_name": tpl.name,
        "rendered_caption": rendered,
        "context_applied": service.build_default_context(payload.context),
    }
