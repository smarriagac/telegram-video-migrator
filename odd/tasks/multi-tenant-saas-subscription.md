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
- S4: MTProto Telethon Session Isolation per Tenant:
  - `TelegramClientPool`: segregated `_tenant_clients` mappings preventing cross-tenant client access.
  - `TelethonAdapter`: tenant-scoped adapter throwing `ChannelAccessDeniedException` if a tenant attempts to operate on another tenant's MTProto client.
  - Channel discovery isolation: `get_managed_channels` restricted to the active tenant's client instances.
- S5: Telegram VIP Gatekeeper & Channel Membership Orchestrator:
  - `ChannelMembership` entity with status lifecycle (`INVITED`, `ACTIVE`, `GRACE_PERIOD`, `EXPIRED`, `KICKED`).
  - `MembershipGatekeeperService`: generation of single-use expiring invite links (`ExportChatInviteRequest`) and automated eviction worker (`EditBannedRequest`).
- S6: Frontend Billing & Subscription Plans View (`/billing`):
  - Tier cards (`FREE_TRIAL`, `CREATOR`, `PRO_AGENCY`, `ENTERPRISE`) with quota indicators, annual discount toggle (-20%), and tenant cluster isolation specs.
- S7: Stripe Checkout & Webhook Integration:
  - `POST /api/billing/checkout`: creates Stripe Checkout session or sandbox fallback.
  - `POST /api/billing/webhook`: processes `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
  - `GET /api/billing/subscription`: returns tenant subscription state and quotas.

## Tasks
- [x] T1 (S1): Create `backend/domain/entities/tenant.py` with `Tenant`, `PlanTier`, `TenantStatus`, and quota validation [inline]
- [x] T2 (S1): Create `backend/domain/entities/subscription.py` with `Subscription`, `SubscriptionStatus`, and billing period validation [inline]
- [x] T3 (S1): Export entities in `backend/domain/entities/__init__.py` [inline]
- [x] T4 (S2): Create SQL migration script in `backend/infrastructure/persistence/migrations/001_multi_tenant_saas.sql` [inline]
- [x] T5 (S3): Implement unit tests in `backend/tests/test_saas_multi_tenant.py` verifying domain logic and quotas [inline]
- [x] T6 (S1-S3): Run full test suite in Docker container to ensure zero regressions [inline]
- [x] T7 (S1-S3): Commit cleanly with Conventional Commits [inline]
- [x] T8 (S4): Refactor `TelegramClientPool` with tenant-segregated client registries and strict boundary checks [inline]
- [x] T9 (S4): Update `TelethonAdapter` to enforce tenant isolation and prevent cross-tenant message/channel operations [inline]
- [x] T10 (S4): Add `tenant_id` to `PostgresRepository` account persistence and apply DDL migration in Postgres database [inline]
- [x] T11 (S4): Implement unit tests in `test_tenant_session_isolation.py` (3 new tests, 80 total tests passing) [inline]
- [x] T12 (S5): Create `ChannelMembership` entity and `MembershipGatekeeperService` with auto-eviction logic [inline]
- [x] T13 (S5): Add `kick_chat_member` and `create_channel_invite_link` to `TelegramGatewayPort` and `TelethonAdapter` [inline]
- [x] T14 (S5): Verify gatekeeper unit tests in `test_membership_gatekeeper.py` (83 total tests passing) [inline]
- [x] T15 (S6): Build `BillingPlansView.tsx` with tier cards, annual toggle, and tenant cluster status [inline]
- [x] T16 (S6): Register `/billing` route in `App.tsx` and sidebar navigation item in `AppLayout.tsx` [inline]
- [x] T17 (S5-S6): Compile frontend bundle and deploy to Docker Nginx container (HTTP 200) [inline]
- [x] T18 (S7): Implement `backend/presentation/api/routers/billing.py` with checkout, webhook, and subscription endpoints [inline]
- [x] T19 (S7): Wire `billingApi.ts` in frontend to trigger checkout from plan cards [inline]
- [x] T20 (S7): Verify full test suite (86 tests passing in backend container) and commit [inline]

## Log
- L1: User requested architecture and data model definition to sell Telegram Hub as a subscription-based multi-tenant SaaS.
- L2: Designed shared database architecture with PostgreSQL RLS + explicit tenant isolation.
- L3: Created ODD task specification.
- L4: Implemented tenant-isolated `TelegramClientPool` and updated `TelethonAdapter` with strict tenant boundary checks.
- L5: Applied PostgreSQL DDL migration `001_multi_tenant_saas.sql` enabling RLS policies on tables.
- L6: Verified 80 tests passing in backend container.
- L7: Implemented `ChannelMembership` entity, `MembershipGatekeeperService`, and MTProto eviction methods (83 tests passing).
- L8: Created `BillingPlansView.tsx` and wired `/billing` into dashboard and sidebar. Built with Vite in 3.48s and deployed to Nginx.
- L9: Implemented Stripe billing router, webhook listener, and frontend billing client (86 tests passing).
