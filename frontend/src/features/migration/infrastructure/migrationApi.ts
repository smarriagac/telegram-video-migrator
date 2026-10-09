import { Channel, MigrationJob } from "../domain/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export const migrationApi = {
  async fetchChannels(): Promise<Channel[]> {
    const res = await fetch(`${API_BASE_URL}/channels`);
    if (!res.ok) {
      throw new Error(`Failed to fetch channels: ${res.statusText}`);
    }
    return res.json();
  },

  async startMigration(sourceChannelId: number, targetChannelId: number): Promise<MigrationJob> {
    const res = await fetch(`${API_BASE_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_channel_id: sourceChannelId,
        target_channel_id: targetChannelId,
      }),
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
