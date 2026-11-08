# Task: Caption & Message Template Manager (ODD Spec)

## Context & Objectives
Operators frequently write promotional copy, channel signatures, disclaimer headers, and caption transformations when configuring migration jobs, scheduled broadcasts, or live-sync channel bindings. Manually re-typing or copy-pasting headers, format tokens, and regex rules leads to inconsistent branding and typos.

This task implements an enterprise-grade **Caption & Message Template Manager**:
1. **Domain Model & Persistence**:
   - Entity [`CaptionTemplate`](file:///home/sm/proyectos/telegram-video-migrator/backend/domain/entities/caption_template.py) storing template ID, tenant ID, name, category (`MIGRATION`, `BROADCAST`, `WATERMARK`, `GENERAL`), header, dynamic body template with variable interpolation tokens, signature footer, associated sanitization rules, and default flag.
   - Database tables `caption_templates` in PostgreSQL and SQLite with indexing and seeding.
   - Backup integration in [`DisasterRecoveryService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/disaster_recovery_service.py).
2. **Dynamic Interpolation Engine**:
   - Service [`TemplateService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/template_service.py) supporting variables `{title}`, `{channel}`, `{year}`, `{date}`, `{quality}`, and automatic rule pipeline application.
3. **REST API**:
   - `GET /api/templates?category=...`: List templates.
   - `POST /api/templates`: Create new template.
   - `GET /api/templates/{id}`: Fetch template details.
   - `PUT /api/templates/{id}`: Update template.
   - `DELETE /api/templates/{id}`: Remove template.
   - `POST /api/templates/{id}/render`: Render with context data.
   - `POST /api/templates/preview`: Live rendering preview.
4. **Frontend Console & Workflow Integration**:
   - Modal/Card [`TemplateManagerModal.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/migration/presentation/components/TemplateManagerModal.tsx) adhering to `<= 2 useState` architectural rule.
   - Quick template picker dropdown integrated into [`PipelineModulesView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/migration/presentation/PipelineModulesView.tsx) and [`RulesPlaygroundCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/migration/presentation/components/RulesPlaygroundCard.tsx).
   - Dynamic tag insertion helpers (`{title}`, `{channel}`, `{year}`) and live preview.
5. **Automated Verification**:
   - Backend pytest suite testing CRUD, variable interpolation, multi-tenant isolation, and API endpoints.
   - Frontend Vitest suite testing template selection, rendering, and CRUD workflows.
