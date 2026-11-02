import {
  SyncBinding,
  LiveSyncHealth,
  CreateSyncBindingPayload,
  UpdateSyncBindingPayload,
} from "../domain/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const syncApi = {
  async fetchBindings(): Promise<SyncBinding[]> {
    const res = await fetch(`${API_BASE_URL}/sync/bindings`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al obtener vinculaciones de sincronización");
    }
    return res.json();
  },

  async fetchHealth(): Promise<LiveSyncHealth> {
    const res = await fetch(`${API_BASE_URL}/sync/health`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al consultar estado de salud del daemon");
    }
    return res.json();
  },

  async createBinding(payload: CreateSyncBindingPayload): Promise<SyncBinding> {
    const res = await fetch(`${API_BASE_URL}/sync/bindings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al crear la vinculación de sincronización");
    }
    return res.json();
  },

  async updateBinding(
    sourceChannelId: number,
    targetChannelId: number,
    payload: UpdateSyncBindingPayload
  ): Promise<SyncBinding> {
    const res = await fetch(
      `${API_BASE_URL}/sync/bindings/${sourceChannelId}/${targetChannelId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al actualizar la vinculación");
    }
    return res.json();
  },

  async deleteBinding(sourceChannelId: number, targetChannelId: number): Promise<void> {
    const res = await fetch(
      `${API_BASE_URL}/sync/bindings/${sourceChannelId}/${targetChannelId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al desvincular canales");
    }
  },

  async reloadDaemon(): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE_URL}/sync/reload`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al recargar listeners de sincronización");
    }
    return res.json();
  },
};
