import { Channel, ChannelMessageItem, JobQueueStatus, MigrationJob } from "../domain/types";

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
    offsetId?: number
  ): Promise<ChannelMessageItem[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (offsetId) {
      params.append("offset_id", offsetId.toString());
    }
    const res = await fetch(`${API_BASE_URL}/channels/${channelId}/messages?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch channel messages: ${res.statusText}`);
    }
    return res.json();
  },

  async startMigration(
    sourceChannelId: number,
    targetChannelId: number,
    selectedMessageIds?: number[]
  ): Promise<MigrationJob> {
    const payload: {
      source_channel_id: number;
      target_channel_id: number;
      selected_message_ids?: number[];
    } = {
      source_channel_id: sourceChannelId,
      target_channel_id: targetChannelId,
    };
    if (selectedMessageIds && selectedMessageIds.length > 0) {
      payload.selected_message_ids = selectedMessageIds;
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

  getStreamUrl(jobId: string): string {
    return `${API_BASE_URL}/jobs/${jobId}/stream`;
  },
};
