import { useAuthStore } from "@/features/auth/application/useAuthStore";

export interface AppNotification {
  id: string;
  tenant_id: string;
  title: string;
  message: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  is_read: boolean;
  link?: string | null;
  created_at?: string | null;
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

export const notificationApi = {
  async getUnreadCount(): Promise<number> {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.unread_count ?? 0;
    } catch {
      return 0;
    }
  },

  async listNotifications(unreadOnly = false, limit = 30): Promise<AppNotification[]> {
    try {
      const url = `/api/notifications?limit=${limit}&unread_only=${unreadOnly}`;
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async markAllAsRead(): Promise<number> {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.marked_read_count ?? 0;
    } catch {
      return 0;
    }
  },
};
