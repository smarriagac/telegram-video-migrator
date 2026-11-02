import { useAuthStore } from "@/features/auth/application/useAuthStore";

export interface ManagedChannel {
  id: number;
  title: string;
  username?: string | null;
  can_post: boolean;
  account_id?: number | null;
  account_name?: string | null;
}

export interface VipMembership {
  id: string;
  tenant_id: string;
  channel_id: number;
  telegram_user_id?: number | null;
  telegram_username?: string | null;
  invite_link?: string | null;
  status: "INVITED" | "ACTIVE" | "GRACE_PERIOD" | "EXPIRED" | "KICKED" | "CANCELLED";
  expires_at: string;
  created_at?: string | null;
}

const getAuthHeaders = (): HeadersInit => {
  const token = useAuthStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const channelApi = {
  async listManagedChannels(): Promise<ManagedChannel[]> {
    const res = await fetch("/api/channels", {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al listar canales gestionados.");
    }
    return res.json();
  },

  async listVipMembers(channelId?: number): Promise<VipMembership[]> {
    const url = channelId
      ? `/api/channels/gatekeeper/members?channel_id=${channelId}`
      : "/api/channels/gatekeeper/members";
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al consultar miembros VIP.");
    }
    return res.json();
  },

  async createVipInvite(
    channelId: number,
    durationDays: number = 30,
    username?: string
  ): Promise<VipMembership> {
    const res = await fetch("/api/channels/gatekeeper/invite", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        channel_id: channelId,
        duration_days: durationDays,
        telegram_username: username || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al generar enlace de invitación VIP.");
    }
    return res.json();
  },

  async evictExpiredMembers(): Promise<{ evicted_count: number }> {
    const res = await fetch("/api/channels/gatekeeper/evict", {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al ejecutar desalojo de miembros.");
    }
    return res.json();
  },
};
