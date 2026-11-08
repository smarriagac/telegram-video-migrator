import { AnalyticsOverview } from "../domain/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const analyticsApi = {
  async fetchOverview(): Promise<AnalyticsOverview> {
    const res = await fetch(`${API_BASE_URL}/analytics/overview`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al obtener analíticas del sistema");
    }
    return res.json();
  },

  async exportAnalytics(format: "csv" | "json" = "csv"): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/analytics/export?format=${format}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al exportar métricas del sistema");
    }
    return res.blob();
  },
};
