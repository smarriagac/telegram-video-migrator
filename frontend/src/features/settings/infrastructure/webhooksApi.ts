const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export type WebhookTargetType = "DISCORD" | "SLACK" | "TELEGRAM_BOT" | "GENERIC";

export interface WebhookEndpoint {
  id: string;
  tenant_id: string;
  name: string;
  target_type: WebhookTargetType;
  url: string;
  secret_token?: string | null;
  events: string[];
  is_enabled: boolean;
  last_status_code?: number | null;
  last_error?: string | null;
  last_dispatched_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateWebhookPayload {
  name: string;
  target_type: WebhookTargetType;
  url: string;
  secret_token?: string | null;
  events: string[];
  is_enabled?: boolean;
}

export interface UpdateWebhookPayload {
  name?: string;
  target_type?: WebhookTargetType;
  url?: string;
  secret_token?: string | null;
  events?: string[];
  is_enabled?: boolean;
}

export interface TestWebhookResult {
  success: boolean;
  status_code?: number | null;
  error?: string | null;
  endpoint?: WebhookEndpoint;
}

export const webhooksApi = {
  listWebhooks: async (isEnabled?: boolean): Promise<WebhookEndpoint[]> => {
    const params = new URLSearchParams();
    if (isEnabled !== undefined) {
      params.append("is_enabled", String(isEnabled));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/webhooks${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al cargar webhooks");
    }
    return res.json();
  },

  createWebhook: async (payload: CreateWebhookPayload): Promise<WebhookEndpoint> => {
    const res = await fetch(`${API_BASE_URL}/webhooks`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: jsonBody(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al registrar webhook");
    }
    return res.json();
  },

  updateWebhook: async (id: string, payload: UpdateWebhookPayload): Promise<WebhookEndpoint> => {
    const res = await fetch(`${API_BASE_URL}/webhooks/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: jsonBody(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al actualizar webhook");
    }
    return res.json();
  },

  deleteWebhook: async (id: string): Promise<{ success: boolean; deleted_id: string }> => {
    const res = await fetch(`${API_BASE_URL}/webhooks/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al eliminar webhook");
    }
    return res.json();
  },

  testWebhook: async (id: string): Promise<TestWebhookResult> => {
    const res = await fetch(`${API_BASE_URL}/webhooks/${id}/test`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al probar webhook");
    }
    return res.json();
  },

  testWebhookUrl: async (payload: {
    target_type: WebhookTargetType;
    url: string;
    secret_token?: string | null;
  }): Promise<TestWebhookResult> => {
    const res = await fetch(`${API_BASE_URL}/webhooks/test-url`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: jsonBody(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al probar URL de webhook");
    }
    return res.json();
  },
};

function jsonBody(data: any): string {
  return JSON.stringify(data);
}
