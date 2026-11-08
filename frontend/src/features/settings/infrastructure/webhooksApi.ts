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

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  tenant_id: string;
  event_type: string;
  url: string;
  payload: Record<string, any>;
  status: "PENDING" | "DELIVERED" | "FAILED" | "DLQ";
  attempts: number;
  max_attempts: number;
  next_retry_at?: string | null;
  last_status_code?: number | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface WebhookDeliveriesSummary {
  total: number;
  dlq: number;
  pending: number;
  delivered: number;
  failed: number;
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

  fetchDeliveriesSummary: async (): Promise<WebhookDeliveriesSummary> => {
    const res = await fetch(`${API_BASE_URL}/webhooks/deliveries/summary`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al obtener resumen de entregas");
    }
    return res.json();
  },

  listDeliveries: async (params?: {
    webhook_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: WebhookDelivery[]; total: number; limit: number; offset: number }> => {
    const q = new URLSearchParams();
    if (params?.webhook_id) q.append("webhook_id", params.webhook_id);
    if (params?.status) q.append("status", params.status);
    if (params?.limit) q.append("limit", String(params.limit));
    if (params?.offset) q.append("offset", String(params.offset));
    const qs = q.toString() ? `?${q.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/webhooks/deliveries${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al listar entregas de webhooks");
    }
    return res.json();
  },

  listDLQDeliveries: async (params?: {
    webhook_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: WebhookDelivery[]; total: number; limit: number; offset: number }> => {
    const q = new URLSearchParams();
    if (params?.webhook_id) q.append("webhook_id", params.webhook_id);
    if (params?.limit) q.append("limit", String(params.limit));
    if (params?.offset) q.append("offset", String(params.offset));
    const qs = q.toString() ? `?${q.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/webhooks/deliveries/dlq${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al listar DLQ de webhooks");
    }
    return res.json();
  },

  retryDelivery: async (id: string): Promise<{ success: boolean; status_code?: number | null; error?: string | null }> => {
    const res = await fetch(`${API_BASE_URL}/webhooks/deliveries/${id}/retry`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al reintentar entrega");
    }
    return res.json();
  },

  retryAllDLQ: async (webhook_id?: string): Promise<{ total_retried: number; succeeded: number; failed: number }> => {
    const q = new URLSearchParams();
    if (webhook_id) q.append("webhook_id", webhook_id);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/webhooks/deliveries/dlq/retry-all${qs}`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al reintentar todas las entregas de DLQ");
    }
    return res.json();
  },

  dismissDelivery: async (id: string): Promise<{ success: boolean; deleted_id: string }> => {
    const res = await fetch(`${API_BASE_URL}/webhooks/deliveries/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al descartar entrega");
    }
    return res.json();
  },
};

function jsonBody(data: any): string {
  return JSON.stringify(data);
}
