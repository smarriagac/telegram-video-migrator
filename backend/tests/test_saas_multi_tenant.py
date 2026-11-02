from __future__ import annotations

from datetime import datetime, timedelta, timezone
from backend.domain.entities.tenant import Tenant, PlanTier, TenantStatus
from backend.domain.entities.subscription import Subscription, SubscriptionStatus, PaymentProvider
from backend.domain.entities.user import User, Role
from backend.domain.entities.telegram_account import TelegramAccount


def test_tenant_creation_defaults_by_tier():
    trial_tenant = Tenant.create(name="Acme Corp", slug="acme")
    assert trial_tenant.name == "Acme Corp"
    assert trial_tenant.slug == "acme"
    assert trial_tenant.plan_tier == PlanTier.FREE_TRIAL
    assert trial_tenant.status == TenantStatus.TRIALING
    assert trial_tenant.max_telegram_accounts == 1
    assert trial_tenant.max_active_sync_bindings == 2

    pro_tenant = Tenant.create(name="Agency VIP", slug="agency-vip", plan_tier=PlanTier.PRO_AGENCY)
    assert pro_tenant.plan_tier == PlanTier.PRO_AGENCY
    assert pro_tenant.max_telegram_accounts == 10
    assert pro_tenant.max_active_sync_bindings == 30
    assert pro_tenant.max_monthly_bandwidth_gb == 1000.0


def test_tenant_quota_boundaries():
    creator = Tenant.create(name="Solo Creator", slug="creator-1", plan_tier=PlanTier.CREATOR)
    # Creator has 2 max accounts
    assert creator.can_add_telegram_account(current_accounts_count=0) is True
    assert creator.can_add_telegram_account(current_accounts_count=1) is True
    assert creator.can_add_telegram_account(current_accounts_count=2) is False

    # Creator has 5 max bindings
    assert creator.can_add_sync_binding(current_bindings_count=4) is True
    assert creator.can_add_sync_binding(current_bindings_count=5) is False


def test_tenant_suspension_blocks_operations():
    suspended_tenant = Tenant.create(name="Bad Debt", slug="bad-debt", status=TenantStatus.SUSPENDED)
    assert suspended_tenant.is_operational() is False
    assert suspended_tenant.can_add_telegram_account(0) is False
    assert suspended_tenant.can_add_sync_binding(0) is False


def test_subscription_expiration_logic():
    now = datetime.now(timezone.utc)
    future = (now + timedelta(days=30)).isoformat()
    past = (now - timedelta(days=1)).isoformat()

    active_sub = Subscription(
        tenant_id="tenant-123",
        plan_tier=PlanTier.CREATOR,
        status=SubscriptionStatus.ACTIVE,
        provider=PaymentProvider.STRIPE,
        current_period_end=future,
    )
    assert active_sub.is_in_good_standing() is True
    assert active_sub.is_expired(now) is False

    expired_sub = Subscription(
        tenant_id="tenant-123",
        plan_tier=PlanTier.CREATOR,
        status=SubscriptionStatus.ACTIVE,
        provider=PaymentProvider.STRIPE,
        current_period_end=past,
    )
    assert expired_sub.is_expired(now) is True


def test_user_and_account_tenant_association():
    tenant = Tenant.create(name="Team Alpha", slug="alpha")
    user = User(
        id=1,
        email="operator@alpha.com",
        password_hash="secret",
        role=Role.OPERATOR,
        tenant_id=tenant.id,
    )
    account = TelegramAccount(
        id=1,
        name="Alpha Bot",
        phone="+1234567890",
        api_id_encrypted="enc_id",
        api_hash_encrypted="enc_hash",
        tenant_id=tenant.id,
    )

    assert user.tenant_id == tenant.id
    assert account.tenant_id == tenant.id
