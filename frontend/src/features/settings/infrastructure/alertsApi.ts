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

export interface AlertConfig {
  alert_recipient: string | null;
  alert_channel_id: number | null;
  notify_flood_wait: boolean;
  notify_job_failures: boolean;
  notify_vip_purchases: boolean;
  notify_evictions: boolean;
}

export const alertsApi = {
  async getAlertConfig(): Promise<{ config: AlertConfig }> {
    const res = await fetch(`${API_BASE_URL}/alerts/config`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Error al obtener configuración de alertas: ${res.statusText}`);
    }
    return res.json();
  },

  async saveAlertConfig(config: AlertConfig): Promise<{ success: boolean; config: AlertConfig }> {
    const res = await fetch(`${API_BASE_URL}/alerts/config`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al guardar configuración de alertas");
    }
    return res.json();
  },

  async sendTestAlert(payload: {
    recipient?: string;
    channel_id?: number;
    severity?: string;
    custom_message?: string;
  }): Promise<{ success: boolean; delivered_to: string }> {
    const res = await fetch(`${API_BASE_URL}/alerts/test`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al enviar alerta de prueba");
    }
    return res.json();
  },
};
