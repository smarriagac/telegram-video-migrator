import {
  Channel,
  ChannelCloningHistory,
  ChannelMessageItem,
  ChannelSyncStatus,
  ClonedContentItem,
  JobQueueStatus,
  MigrationJob,
} from "../domain/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const migrationApi = {
  async fetchChannels(): Promise<Channel[]> {
    const res = await fetch(`${API_BASE_URL}/channels`);
    if (!res.ok) {
      throw new Error(`Failed to fetch channels: ${res.statusText}`);
    }
    return res.json();
  },

  async fetchChannelMessages(
    channelId: number,
    limit: number = 50,
    offsetId?: number,
    targetChannelId?: number
  ): Promise<ChannelMessageItem[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (offsetId) {
      params.append("offset_id", offsetId.toString());
    }
    if (targetChannelId) {
      params.append("target_channel_id", targetChannelId.toString());
    }
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/messages?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch channel messages: ${res.statusText}`);
    }
    return res.json();
  },

  async fetchChannelSyncStatus(
    sourceChannelId: number,
    targetChannelId: number
  ): Promise<ChannelSyncStatus> {
    const res = await fetch(
      `${API_BASE_URL}/channels/${sourceChannelId}/sync-status?target_channel_id=${targetChannelId}`
    );
    if (!res.ok) {
      throw new Error(`Failed to check sync status: ${res.statusText}`);
    }
    return res.json();
  },

  async triggerDeltaSync(
    sourceChannelId: number,
    targetChannelId: number,
    sourceChannelTitle?: string,
    targetChannelTitle?: string
  ): Promise<{ job_id: string; total_videos: number; status: string }> {
    const payload = {
      target_channel_id: targetChannelId,
      source_channel_title: sourceChannelTitle,
      target_channel_title: targetChannelTitle,
    };
    const res = await fetch(`${API_BASE_URL}/channels/${sourceChannelId}/sync-delta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al iniciar sincronización delta");
    }
    return res.json();
  },

  async startMigration(
    sourceChannelId: number,
    targetChannelId: number,
    selectedMessageIds?: number[],
    sourceChannelTitle?: string,
    targetChannelTitle?: string
  ): Promise<MigrationJob> {
    const payload: {
      source_channel_id: number;
      target_channel_id: number;
      selected_message_ids?: number[];
      source_channel_title?: string;
      target_channel_title?: string;
    } = {
      source_channel_id: sourceChannelId,
      target_channel_id: targetChannelId,
    };
    if (selectedMessageIds && selectedMessageIds.length > 0) {
      payload.selected_message_ids = selectedMessageIds;
    }
    if (sourceChannelTitle) {
      payload.source_channel_title = sourceChannelTitle;
    }
    if (targetChannelTitle) {
      payload.target_channel_title = targetChannelTitle;
    }

    const res = await fetch(`${API_BASE_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to start migration job");
    }
    return res.json();
  },

  async fetchChannelCloningHistory(channelId: number): Promise<ChannelCloningHistory> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/cloning-history`);
    if (!res.ok) {
      throw new Error(`Failed to fetch channel cloning history: ${res.statusText}`);
    }
    return res.json();
  },

  async fetchChannelClonedContent(channelId: number): Promise<ClonedContentItem[]> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/cloned-content`);
    if (!res.ok) {
      throw new Error(`Failed to fetch channel cloned content: ${res.statusText}`);
    }
    return res.json();
  },

  async getJob(jobId: string): Promise<MigrationJob> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch job: ${res.statusText}`);
    }
    return res.json();
  },

  async getJobQueue(jobId: string): Promise<JobQueueStatus> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/queue`);
    if (!res.ok) {
      throw new Error(`Failed to fetch job queue: ${res.statusText}`);
    }
    return res.json();
  },

  async cancelJob(jobId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/cancel`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(`Failed to cancel job: ${res.statusText}`);
    }
  },

  async uploadToChannel(
    channelId: number,
    file?: File | null,
    caption?: string,
    text?: string
  ): Promise<ChannelMessageItem> {
    const formData = new FormData();
    if (file) {
      formData.append("file", file);
    }
    if (caption) {
      formData.append("caption", caption);
    }
    if (text) {
      formData.append("text", text);
    }
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al subir contenido a Telegram");
    }
    return res.json();
  },

  async deleteChannelMessage(channelId: number, messageId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error("Error al eliminar mensaje del canal");
    }
  },

  async editChannelMessage(
    channelId: number,
    messageId: number,
    text: string
  ): Promise<ChannelMessageItem> {
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new Error("Error al editar mensaje");
    }
    return res.json();
  },

  getStreamUrl(jobId: string): string {
    return `${API_BASE_URL}/jobs/${jobId}/stream`;
  },
};
