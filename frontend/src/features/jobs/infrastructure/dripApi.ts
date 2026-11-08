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

export interface DripCampaign {
  id: string;
  title: string;
  source_channel_id: number;
  target_channel_id: number;
  source_channel_title?: string;
  target_channel_title?: string;
  source_account_id?: number;
  target_account_id?: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  interval_minutes: number;
  batch_size: number;
  jitter_seconds: number;
  daily_window_start?: string;
  daily_window_end?: string;
  caption_rules?: any;
  next_release_at?: string;
  total_items: number;
  released_items: number;
  failed_items: number;
  created_at: string;
  updated_at: string;
}

export interface ReservoirItem {
  id: string;
  campaign_id: string;
  source_message_id: number;
  media_type: string;
  file_id?: string;
  original_caption: string;
  transformed_caption: string;
  status: "QUEUED" | "RELEASED" | "SKIPPED" | "FAILED";
  scheduled_at: string;
  released_at?: string;
  published_message_id?: number;
  error_message?: string;
  position: number;
  created_at: string;
}

export interface CreateCampaignPayload {
  title: string;
  source_channel_id: number;
  target_channel_id: number;
  source_message_ids: number[];
  source_channel_title?: string;
  target_channel_title?: string;
  source_account_id?: number;
  target_account_id?: number;
  interval_minutes?: number;
  batch_size?: number;
  jitter_seconds?: number;
  daily_window_start?: string;
  daily_window_end?: string;
  caption_rules?: any;
}

export const dripApi = {
  async fetchCampaigns(status?: string): Promise<DripCampaign[]> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    const res = await fetch(`${API_BASE_URL}/reservoir/campaigns?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("No se pudieron cargar las campañas del reservorio");
    }
    return res.json();
  },

  async getCampaign(id: string): Promise<DripCampaign> {
    const res = await fetch(`${API_BASE_URL}/reservoir/campaigns/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Campaña no encontrada");
    return res.json();
  },

  async createCampaign(payload: CreateCampaignPayload): Promise<{ message: string; campaign: DripCampaign }> {
    const res = await fetch(`${API_BASE_URL}/reservoir/campaigns`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error al crear la campaña" }));
      throw new Error(err.detail || "Error al crear la campaña");
    }
    return res.json();
  },

  async pauseCampaign(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/reservoir/campaigns/${id}/pause`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Error al pausar la campaña");
  },

  async resumeCampaign(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/reservoir/campaigns/${id}/resume`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Error al reactivar la campaña");
  },

  async deleteCampaign(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/reservoir/campaigns/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Error al eliminar la campaña");
  },

  async fetchCampaignItems(
    campaignId: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ items: ReservoirItem[]; total: number }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (status) params.append("status", status);
    const res = await fetch(`${API_BASE_URL}/reservoir/campaigns/${campaignId}/items?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Error al cargar los elementos del reservorio");
    return res.json();
  },

  async releaseItemNow(itemId: string): Promise<{ message: string; item: ReservoirItem }> {
    const res = await fetch(`${API_BASE_URL}/reservoir/items/${itemId}/release-now`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error al publicar elemento" }));
      throw new Error(err.detail || "Error al publicar elemento inmediatamente");
    }
    return res.json();
  },

  async updateItemCaption(itemId: string, caption: string): Promise<{ message: string; item: ReservoirItem }> {
    const res = await fetch(`${API_BASE_URL}/reservoir/items/${itemId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ caption }),
    });
    if (!res.ok) throw new Error("Error al actualizar caption del elemento");
    return res.json();
  },

  async skipItem(itemId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/reservoir/items/${itemId}/skip`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Error al omitir elemento");
  },
};
