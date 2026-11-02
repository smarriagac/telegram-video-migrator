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
  joined_at?: string | null;
  expires_at: string;
  created_at?: string | null;
  dm_sent?: boolean;
  dm_error?: string | null;
}

export interface JoinRequest {
  channel_id: number;
  user_id: number;
  date?: string | null;
  first_name: string;
  last_name: string;
  username?: string | null;
  about?: string | null;
}

const getAuthHeaders = (): HeadersInit => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    useAuthStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const channelApi = {
  async listManagedChannels(): Promise<ManagedChannel[]> {
    try {
      const res = await fetch("/api/channels", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        return [];
      }
      return await res.json();
    } catch {
      return [];
    }
  },

  async listVipMembers(channelId?: number): Promise<VipMembership[]> {
    try {
      const url = channelId
        ? `/api/channels/gatekeeper/members?channel_id=${channelId}`
        : "/api/channels/gatekeeper/members";
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        return [];
      }
      return await res.json();
    } catch {
      return [];
    }
  },

  async createVipInvite(
    channelId: number,
    durationDays: number = 30,
    username?: string,
    autoSendDm: boolean = true
  ): Promise<VipMembership> {
    const res = await fetch("/api/channels/gatekeeper/invite", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        channel_id: channelId,
        duration_days: durationDays,
        telegram_username: username || null,
        auto_send_dm: autoSendDm,
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

  async listJoinRequests(channelId?: number): Promise<JoinRequest[]> {
    try {
      const url = channelId
        ? `/api/channels/gatekeeper/requests?channel_id=${channelId}`
        : "/api/channels/gatekeeper/requests";
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        return [];
      }
      return await res.json();
    } catch {
      return [];
    }
  },

  async approveJoinRequest(
    channelId: number,
    userId: number,
    durationDays: number = 30,
    username?: string
  ): Promise<any> {
    const res = await fetch("/api/channels/gatekeeper/requests/approve", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        channel_id: channelId,
        user_id: userId,
        duration_days: durationDays,
        username: username || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al aprobar solicitud de ingreso.");
    }
    return res.json();
  },

  async rejectJoinRequest(channelId: number, userId: number): Promise<any> {
    const res = await fetch("/api/channels/gatekeeper/requests/reject", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        channel_id: channelId,
        user_id: userId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al rechazar solicitud.");
    }
    return res.json();
  },

  async kickMember(
    channelId: number,
    userId: number,
    membershipId?: string,
    reason: string = "Incumplimiento de normas"
  ): Promise<any> {
    const res = await fetch("/api/channels/gatekeeper/kick", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        channel_id: channelId,
        user_id: userId,
        membership_id: membershipId || null,
        reason: reason,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al expulsar al miembro del canal.");
    }
    return res.json();
  },
};
