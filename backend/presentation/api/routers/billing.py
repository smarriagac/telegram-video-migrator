from __future__ import annotations

import logging
import os
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
import stripe

from backend.domain.entities.tenant import PlanTier, TenantStatus, TIER_DEFAULT_QUOTAS
from backend.domain.entities.subscription import SubscriptionStatus
from backend.domain.entities.user import User
from backend.presentation.dependencies import get_current_user, get_postgres_repository
from backend.infrastructure.persistence.postgres_repository import PostgresRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["Billing & SaaS Subscriptions"])

TIER_PRICING = {
    PlanTier.FREE_TRIAL: {"monthly": 0, "annual": 0},
    PlanTier.CREATOR: {"monthly": 2900, "annual": 2300 * 12},  # In cents
    PlanTier.PRO_AGENCY: {"monthly": 8900, "annual": 7100 * 12},
    PlanTier.ENTERPRISE: {"monthly": 24900, "annual": 19900 * 12},
}


class CheckoutRequest(BaseModel):
    tier: PlanTier
    annual: bool = False


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    mock: bool = False


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
) -> CheckoutResponse:
    """Create a Stripe Checkout Session for subscription upgrade."""
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    tier_info = TIER_PRICING.get(payload.tier, TIER_PRICING[PlanTier.CREATOR])
    amount = tier_info["annual"] if payload.annual else tier_info["monthly"]

    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"

    # If Stripe API key is configured, create live Stripe Checkout Session
    if stripe_key and not stripe_key.startswith("mock_"):
        try:
            stripe.api_key = stripe_key
            success_url = os.getenv(
                "FRONTEND_URL", "http://localhost:7900"
            ) + "/billing?status=success&session_id={CHECKOUT_SESSION_ID}"
            cancel_url = os.getenv("FRONTEND_URL", "http://localhost:7900") + "/billing?status=cancelled"

            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="subscription",
                customer_email=current_user.email,
                line_items=[
                    {
                        "price_data": {
                            "currency": "usd",
                            "product_data": {
                                "name": f"Telegram Hub - Plan {payload.tier.value}",
                                "description": f"Suscripción {'Anual' if payload.annual else 'Mensual'} a Telegram Hub",
                            },
                            "unit_amount": amount,
                            "recurring": {
                                "interval": "year" if payload.annual else "month",
                            },
                        },
                        "quantity": 1,
                    }
                ],
                metadata={
                    "tenant_id": tenant_id,
                    "plan_tier": payload.tier.value,
                    "user_email": current_user.email,
                },
                success_url=success_url,
                cancel_url=cancel_url,
            )
            return CheckoutResponse(
                checkout_url=session.url or "",
                session_id=session.id,
                mock=False,
            )
        except Exception as e:
            logger.error(f"Error creating Stripe checkout session: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error connecting to Stripe API: {str(e)}",
            )

    # Fallback sandbox checkout link when Stripe keys are being configured separately
    simulated_session_id = f"cs_test_mock_{payload.tier.value.lower()}"
    simulated_url = f"/billing?status=simulated_success&tier={payload.tier.value}&session_id={simulated_session_id}"
    return CheckoutResponse(
        checkout_url=simulated_url,
        session_id=simulated_session_id,
        mock=True,
    )


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    repo: PostgresRepository = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Receive asynchronous payment and lifecycle webhooks from Stripe."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    event: dict[str, Any]
    if webhook_secret and sig_header:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except Exception as e:
            logger.warning(f"Invalid Stripe webhook signature: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
    else:
        # Development / Sandbox fallback without signature verification
        import json
        try:
            event = json.loads(payload.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed payload")

    event_type = event.get("type", "")
    logger.info(f"Stripe Webhook received event: {event_type}")

    if event_type == "checkout.session.completed":
        session = event.get("data", {}).get("object", {})
        metadata = session.get("metadata", {})
        tenant_id = metadata.get("tenant_id")
        plan_tier_str = metadata.get("plan_tier", "CREATOR")
        sub_id = session.get("subscription")
        cust_id = session.get("customer")

        if tenant_id:
            try:
                await repo.connect()
                if repo.pool:
                    tier = PlanTier(plan_tier_str)
                    quotas = TIER_DEFAULT_QUOTAS.get(tier, TIER_DEFAULT_QUOTAS[PlanTier.FREE_TRIAL])
                    async with repo.pool.acquire() as conn:
                        # Upgrade tenant quotas and active status
                        await conn.execute(
                            """
                            UPDATE tenants
                            SET plan_tier = $1,
                                status = 'ACTIVE',
                                max_telegram_accounts = $2,
                                max_active_sync_bindings = $3,
                                max_monthly_bandwidth_gb = $4,
                                updated_at = NOW()
                            WHERE id = $5::uuid
                            """,
                            tier.value,
                            quotas["max_telegram_accounts"],
                            quotas["max_active_sync_bindings"],
                            quotas["max_monthly_bandwidth_gb"],
                            tenant_id,
                        )
                        # Upsert subscription row
                        await conn.execute(
                            """
                            INSERT INTO subscriptions (
                                tenant_id, plan_tier, status, provider,
                                provider_customer_id, provider_subscription_id, updated_at
                            )
                            VALUES ($1::uuid, $2, 'ACTIVE', 'STRIPE', $3, $4, NOW())
                            ON CONFLICT DO NOTHING
                            """,
                            tenant_id,
                            tier.value,
                            cust_id,
                            sub_id,
                        )
                        logger.info(f"Stripe Webhook: upgraded tenant '{tenant_id}' to plan {tier.value}.")
            except Exception as ex:
                logger.error(f"Error updating tenant from Stripe webhook: {ex}")

    elif event_type in ("customer.subscription.deleted", "customer.subscription.past_due"):
        sub = event.get("data", {}).get("object", {})
        sub_id = sub.get("id")
        new_status = "CANCELED" if event_type == "customer.subscription.deleted" else "PAST_DUE"

        try:
            await repo.connect()
            if repo.pool:
                async with repo.pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE subscriptions
                        SET status = $1, updated_at = NOW()
                        WHERE provider_subscription_id = $2
                        """,
                        new_status,
                        sub_id,
                    )
                    # Also update tenant status
                    await conn.execute(
                        """
                        UPDATE tenants t
                        SET status = $1, updated_at = NOW()
                        FROM subscriptions s
                        WHERE s.tenant_id = t.id AND s.provider_subscription_id = $2
                        """,
                        new_status,
                        sub_id,
                    )
        except Exception as ex:
            logger.error(f"Error handling subscription termination in webhook: {ex}")

    return {"received": True, "event_type": event_type}


@router.get("/subscription")
async def get_current_subscription(
    current_user: User = Depends(get_current_user),
    repo: PostgresRepository = Depends(get_postgres_repository),
) -> dict[str, Any]:
    """Retrieve active tenant subscription status and quotas."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    default_payload = {
        "tenant_id": tenant_id,
        "plan_tier": PlanTier.FREE_TRIAL.value,
        "status": TenantStatus.ACTIVE.value,
        "quotas": TIER_DEFAULT_QUOTAS[PlanTier.FREE_TRIAL],
    }

    try:
        await repo.connect()
        if not repo.pool:
            return default_payload

        async with repo.pool.acquire() as conn:
            tenant_row = await conn.fetchrow(
                """
                SELECT id, name, plan_tier, status, max_telegram_accounts, max_active_sync_bindings, max_monthly_bandwidth_gb
                FROM tenants
                WHERE id = $1::uuid
                """,
                tenant_id,
            )
            if not tenant_row:
                return default_payload

            return {
                "tenant_id": str(tenant_row["id"]),
                "name": tenant_row["name"],
                "plan_tier": tenant_row["plan_tier"],
                "status": tenant_row["status"],
                "quotas": {
                    "max_telegram_accounts": tenant_row["max_telegram_accounts"],
                    "max_active_sync_bindings": tenant_row["max_active_sync_bindings"],
                    "max_monthly_bandwidth_gb": float(tenant_row["max_monthly_bandwidth_gb"]),
                },
            }
    except Exception as e:
        logger.warning(f"Error fetching subscription for tenant {tenant_id}: {e}")
        return default_payload
