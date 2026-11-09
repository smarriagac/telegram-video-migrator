export interface FeedSourceItem {
  id: string;
  tenant_id: string;
  title: string;
  source_url: string;
  platform: "tiktok" | "youtube" | "instagram" | "web" | string;
  target_channel_id: number;
  target_channel_title?: string | null;
  is_active: boolean;
  check_interval_minutes: number;
  pipeline_config: {
    aspect_ratio_mode?: string;
    burn_subtitles?: boolean;
    subtitle_style?: string;
    slice_stories?: boolean;
    slice_dispatch_mode?: string;
    generate_thumbnail?: boolean;
    mode?: "RESERVOIR" | "DIRECT";
    campaign_id?: string | null;
    branding_text?: string;
  };
  last_checked_at?: string | null;
  last_video_id?: string | null;
  total_ingested: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedPayload {
  title: string;
  source_url: string;
  platform?: string;
  target_channel_id: number;
  target_channel_title?: string;
  check_interval_minutes?: number;
  pipeline_config?: Record<string, any>;
}

const getAuthHeaders = (): HeadersInit => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const feedWatcherApi = {
  async list(): Promise<{ success: boolean; total: number; feeds: FeedSourceItem[] }> {
    const res = await fetch("/api/feeds", {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to list feeds (${res.status})`);
    }
    return res.json();
  },

  async create(payload: CreateFeedPayload): Promise<{ success: boolean; feed: FeedSourceItem }> {
    const res = await fetch("/api/feeds", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create feed source (${res.status})`);
    }
    return res.json();
  },

  async checkNow(feedId: string): Promise<{ success: boolean; result: any }> {
    const res = await fetch(`/api/feeds/${feedId}/check-now`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to poll feed (${res.status})`);
    }
    return res.json();
  },

  async toggle(feedId: string): Promise<{ success: boolean; is_active: boolean; feed: FeedSourceItem }> {
    const res = await fetch(`/api/feeds/${feedId}/toggle`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to toggle feed (${res.status})`);
    }
    return res.json();
  },

  async delete(feedId: string): Promise<{ success: boolean; deleted_id: string }> {
    const res = await fetch(`/api/feeds/${feedId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to delete feed (${res.status})`);
    }
    return res.json();
  },
};
