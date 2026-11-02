-- ==============================================================================
-- Telegram Hub SaaS: Multi-Tenant Architecture & Row-Level Security (RLS)
-- ==============================================================================

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'FREE_TRIAL',
    status VARCHAR(50) NOT NULL DEFAULT 'TRIALING',
    max_telegram_accounts INT NOT NULL DEFAULT 1,
    max_active_sync_bindings INT NOT NULL DEFAULT 2,
    max_monthly_bandwidth_gb NUMERIC(10, 2) NOT NULL DEFAULT 10.0,
    custom_caption_rules_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_tier VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    provider VARCHAR(50) NOT NULL DEFAULT 'STRIPE',
    provider_customer_id VARCHAR(255),
    provider_subscription_id VARCHAR(255),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub ON subscriptions(provider_subscription_id);

-- 3. Default Tenant for backwards compatibility during migration
INSERT INTO tenants (id, name, slug, plan_tier, status, max_telegram_accounts, max_active_sync_bindings, max_monthly_bandwidth_gb)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default', 'ENTERPRISE', 'ACTIVE', 50, 200, 10000.0)
ON CONFLICT (slug) DO NOTHING;

-- 4. Alter existing core tables to add tenant_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE users SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

ALTER TABLE telegram_accounts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE telegram_accounts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_tenant_id ON telegram_accounts(tenant_id);

ALTER TABLE channel_sync_bindings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE channel_sync_bindings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_channel_sync_bindings_tenant_id ON channel_sync_bindings(tenant_id);

ALTER TABLE migration_jobs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE migration_jobs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_migration_jobs_tenant_id ON migration_jobs(tenant_id);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE audit_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- 5. Row-Level Security (RLS) Configuration
-- Each tenant connection sets `SET LOCAL app.current_tenant_id = '...'`
-- System superadmins bypass RLS via NULL or admin setting.

ALTER TABLE telegram_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_telegram_accounts ON telegram_accounts;
CREATE POLICY tenant_isolation_telegram_accounts ON telegram_accounts
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );

ALTER TABLE channel_sync_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_channel_sync ON channel_sync_bindings;
CREATE POLICY tenant_isolation_channel_sync ON channel_sync_bindings
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );

ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_migration_jobs ON migration_jobs;
CREATE POLICY tenant_isolation_migration_jobs ON migration_jobs
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );
