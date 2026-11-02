import { useAuthStore } from "@/features/auth/application/useAuthStore";

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
  mock: boolean;
}

export interface SubscriptionInfo {
  tenant_id: string;
  name?: string;
  plan_tier: string;
  status: string;
  quotas: {
    max_telegram_accounts: number;
    max_active_sync_bindings: number;
    max_monthly_bandwidth_gb: number;
  };
}

const getAuthHeaders = (): HeadersInit => {
  const token = useAuthStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const billingApi = {
  async createCheckoutSession(tier: string, annual: boolean): Promise<CheckoutResponse> {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ tier, annual }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al iniciar sesión de pago con Stripe");
    }
    return res.json();
  },

  async getSubscription(): Promise<SubscriptionInfo> {
    const res = await fetch("/api/billing/subscription", {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al obtener datos de suscripción");
    }
    return res.json();
  },
};
