import { PaginatedAuditLogs } from "../domain/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const auditApi = {
  async fetchAuditLogs(params?: {
    action?: string;
    user_email?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedAuditLogs> {
    const searchParams = new URLSearchParams();
    if (params?.action && params.action !== "ALL") {
      searchParams.append("action", params.action);
    }
    if (params?.user_email) {
      searchParams.append("user_email", params.user_email);
    }
    if (params?.page) {
      searchParams.append("page", params.page.toString());
    }
    if (params?.pageSize) {
      searchParams.append("page_size", params.pageSize.toString());
    }

    const token =
      localStorage.getItem("telegram_hub_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("token");
    const res = await fetch(`${API_BASE_URL}/audit?${searchParams.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al obtener registros de auditoría");
    }
    return res.json();
  },

  async exportAuditLogs(params?: {
    format?: "csv" | "json" | "html";
    action?: string;
    user_email?: string;
    limit?: number;
  }): Promise<Blob> {
    const searchParams = new URLSearchParams();
    searchParams.append("format", params?.format || "csv");
    if (params?.action && params.action !== "ALL") {
      searchParams.append("action", params.action);
    }
    if (params?.user_email) {
      searchParams.append("user_email", params.user_email);
    }
    if (params?.limit) {
      searchParams.append("limit", params.limit.toString());
    }

    const token =
      localStorage.getItem("telegram_hub_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("token");
    const res = await fetch(`${API_BASE_URL}/audit/export?${searchParams.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al exportar registros de auditoría");
    }
    return res.blob();
  },
};
