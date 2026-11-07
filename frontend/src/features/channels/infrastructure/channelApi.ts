import { useAuthStore } from "@/features/auth/application/useAuthStore";

export interface ManagedChannel {
  id: number;
  title: string;
  username?: string | null;
  can_post: boolean;
  account_id?: number | null;
  account_name?: string | null;
  type?: "channel" | "supergroup" | "group";
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
  kick_reason?: string | null;
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

export interface ScheduledBroadcastCampaign {
  id: string;
  name?: string | null;
  target_ids: number[];
  text: string;
  media_paths: string[];
  account_id?: number | null;
  scheduled_at: string;
  recurrence: "ONCE" | "EVERY_6_HOURS" | "EVERY_12_HOURS" | "DAILY" | "WEEKLY";
  status: "SCHEDULED" | "RUNNING" | "COMPLETED" | "CANCELLED" | "FAILED";
  last_run_at?: string | null;
  run_count: number;
  last_error?: string | null;
  created_at: string;
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

  async listVipMembers(filter?: {
    channelId?: number;
    userId?: number;
    username?: string;
    status?: string;
  } | number): Promise<VipMembership[]> {
    try {
      let url = "/api/channels/gatekeeper/members";
      const queryParams = new URLSearchParams();
      if (typeof filter === "number") {
        queryParams.append("channel_id", String(filter));
      } else if (filter) {
        if (filter.channelId !== undefined) queryParams.append("channel_id", String(filter.channelId));
        if (filter.userId !== undefined) queryParams.append("user_id", String(filter.userId));
        if (filter.username) queryParams.append("username", filter.username);
        if (filter.status) queryParams.append("status", filter.status);
      }
      const qs = queryParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
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

  async kickBatchMembers(payload: {
    items: Array<{ channel_id: number; user_id: number; membership_id?: string | null }>;
    reason?: string;
    accountId?: number | null;
  }): Promise<{ success: boolean; total_requested: number; kicked_count: number; failed_count: number; errors: string[] }> {
    const res = await fetch("/api/channels/gatekeeper/kick-batch", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        items: payload.items,
        reason: payload.reason || "Expulsión en lote por administrador",
        account_id: payload.accountId || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al expulsar a los miembros en lote.");
    }
    return res.json();
  },

  async addMemberToChannel(payload: {
    channelId: number;
    userIdOrUsername: string;
    durationDays?: number;
    directInvite?: boolean;
    autoSendDm?: boolean;
    accountId?: number | null;
  }): Promise<any> {
    const res = await fetch("/api/channels/gatekeeper/add_member", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        channel_id: payload.channelId,
        user_id_or_username: payload.userIdOrUsername,
        duration_days: payload.durationDays || 30,
        direct_invite: payload.directInvite || false,
        auto_send_dm: payload.autoSendDm ?? true,
        account_id: payload.accountId || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al agregar miembro al canal.");
    }
    return res.json();
  },

  async processPaymentWebhook(payload: {
    channelId: number;
    userIdOrUsername: string;
    durationDays?: number;
    amount?: number;
    currency?: string;
    paymentProvider?: string;
    paymentId?: string;
    autoSendDm?: boolean;
    secretToken?: string;
  }): Promise<any> {
    const res = await fetch("/api/channels/gatekeeper/webhooks/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel_id: payload.channelId,
        user_id_or_username: payload.userIdOrUsername,
        duration_days: payload.durationDays || 30,
        amount: payload.amount || null,
        currency: payload.currency || "USD",
        payment_provider: payload.paymentProvider || "STRIPE",
        payment_id: payload.paymentId || null,
        auto_send_dm: payload.autoSendDm ?? true,
        secret_token: payload.secretToken || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al procesar webhook de pago.");
    }
    return res.json();
  },

  async broadcastMessage(payload: {
    targetIds: number[];
    text: string;
    files?: File[];
    accountId?: number | null;
  }): Promise<{
    status: "success" | "failed";
    total_targets: number;
    successful_count: number;
    failed_count: number;
    results: Array<{
      target_id: number;
      message_id: number | null;
      status: "success" | "failed";
      error: string | null;
    }>;
  }> {
    const formData = new FormData();
    formData.append("target_ids", payload.targetIds.join(","));
    formData.append("text", payload.text);
    if (payload.accountId) {
      formData.append("account_id", String(payload.accountId));
    }
    if (payload.files) {
      for (const file of payload.files) {
        formData.append("files", file);
      }
    }

    const token =
      localStorage.getItem("telegram_hub_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("token") ||
      useAuthStore.getState().token;

    const res = await fetch("/api/channels/broadcast", {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al difundir el mensaje.");
    }
    return res.json();
  },

  async scheduleBroadcast(payload: {
    targetIds: number[];
    text: string;
    scheduledAt: string;
    recurrence: string;
    name?: string;
    accountId?: number | null;
    files?: File[];
  }): Promise<ScheduledBroadcastCampaign> {
    const formData = new FormData();
    formData.append("target_ids", payload.targetIds.join(","));
    formData.append("text", payload.text);
    formData.append("scheduled_at", payload.scheduledAt);
    formData.append("recurrence", payload.recurrence);
    if (payload.name) formData.append("name", payload.name);
    if (payload.accountId) formData.append("account_id", String(payload.accountId));
    if (payload.files) {
      for (const file of payload.files) {
        formData.append("files", file);
      }
    }

    const token =
      localStorage.getItem("telegram_hub_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("token") ||
      useAuthStore.getState().token;

    const res = await fetch("/api/channels/broadcast/schedule", {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al programar la difusión.");
    }
    return res.json();
  },

  async listScheduledBroadcasts(status?: string): Promise<ScheduledBroadcastCampaign[]> {
    const token =
      localStorage.getItem("telegram_hub_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("token") ||
      useAuthStore.getState().token;

    const url = status ? `/api/channels/broadcast/scheduled?status=${status}` : `/api/channels/broadcast/scheduled`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) return [];
    return res.json();
  },

  async cancelScheduledBroadcast(campaignId: string): Promise<void> {
    const token =
      localStorage.getItem("telegram_hub_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("token") ||
      useAuthStore.getState().token;

    const res = await fetch(`/api/channels/broadcast/scheduled/${campaignId}`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al cancelar la campaña programada.");
    }
  },
};
