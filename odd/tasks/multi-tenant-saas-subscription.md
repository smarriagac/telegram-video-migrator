# Feature: Multi-Tenant SaaS & Subscription Data Model
Define the foundational multi-tenant data model, subscription tiers, resource quotas, and PostgreSQL Row-Level Security (RLS) architecture to transform Telegram Hub into a commercial B2B/B2C SaaS platform.
Delivery strategy: single-pr

## Specs
- S1: Multi-tenant Domain Entities:
  - `Tenant`: Organization/workspace with slug, name, plan tier, status (`ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`), and quota limits (max Telegram accounts, max active sync bindings, monthly bandwidth GB).
  - `Subscription`: Billing entity linking tenant to payment provider (Stripe customer ID, subscription ID, current period start/end, auto-renewal flag).
  - `PlanTier`: `FREE_TRIAL`, `CREATOR`, `PRO_AGENCY`, `ENTERPRISE`.
- S2: Multi-Tenant Schema & PostgreSQL RLS Migration:
  - SQL DDL defining `tenants` and `subscriptions` tables.
  - Adding `tenant_id UUID` foreign keys and compound indices `(tenant_id, ...)` across existing entities (`telegram_accounts`, `users`, `channel_sync_bindings`, `migration_jobs`, `audit_logs`).
  - Row-Level Security (RLS) policy template: `USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)`.
- S3: Unit tests verifying domain entity creation, quota enforcement logic, and serialization.

## Tasks
- [x] T1 (S1): Create `backend/domain/entities/tenant.py` with `Tenant`, `PlanTier`, `TenantStatus`, and quota validation [inline]
- [x] T2 (S1): Create `backend/domain/entities/subscription.py` with `Subscription`, `SubscriptionStatus`, and billing period validation [inline]
- [x] T3 (S1): Export entities in `backend/domain/entities/__init__.py` [inline]
- [x] T4 (S2): Create SQL migration script in `backend/infrastructure/persistence/migrations/001_multi_tenant_saas.sql` [inline]
- [x] T5 (S3): Implement unit tests in `backend/tests/test_saas_multi_tenant.py` verifying domain logic and quotas [inline]
- [x] T6 (S1-S3): Run full test suite in Docker container to ensure zero regressions [inline]
- [x] T7 (S1-S3): Commit cleanly with Conventional Commits [inline]

## Log
- L1: User requested architecture and data model definition to sell Telegram Hub as a subscription-based multi-tenant SaaS.
- L2: Designed shared database architecture with PostgreSQL RLS + explicit tenant isolation.
- L3: Created ODD task specification.
