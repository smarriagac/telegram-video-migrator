import { useAuthStore } from "@/features/auth/application/useAuthStore";

export interface VideoProcessingJob {
  id: string;
  tenant_id: string;
  source_channel_id: number;
  source_channel_title?: string | null;
  source_message_id: number;
  target_channel_id: number;
  target_channel_title?: string | null;
  filter_type: "delogo" | "blur" | "watermark_text" | "delogo_and_watermark";
  filter_params: {
    preset?: "center" | "top_right" | "bottom_right" | "bottom_bar" | "custom";
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };
  status: "PENDING" | "DOWNLOADING" | "PROCESSING" | "UPLOADING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  original_caption?: string | null;
  new_caption?: string | null;
  target_message_id?: number | null;
  error_message?: string | null;
  account_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface EnqueueVideoPayload {
  source_channel_id: number;
  source_message_id: number;
  target_channel_id: number;
  filter_type?: "delogo" | "blur" | "watermark_text" | "delogo_and_watermark";
  filter_params?: Record<string, any>;
  source_channel_title?: string;
  target_channel_title?: string;
  account_id?: number | null;
  new_caption?: string | null;
}

export interface EnqueueBatchPayload {
  source_channel_id: number;
  source_message_ids: number[];
  target_channel_id: number;
  filter_type?: "delogo" | "blur" | "watermark_text" | "delogo_and_watermark";
  filter_params?: Record<string, any>;
  source_channel_title?: string;
  target_channel_title?: string;
  account_id?: number | null;
}

export interface WatermarkDetectionResult {
  success: boolean;
  detected: boolean;
  confidence: number;
  preset: "center" | "top_right" | "bottom_right" | "bottom_bar" | "top_left" | "custom";
  box?: { x: number; y: number; w: number; h: number };
  normalized_box?: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
  text?: string | null;
  method?: string;
  message?: string;
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

export const videoProcessingApi = {
  async enqueue(payload: EnqueueVideoPayload): Promise<{ success: boolean; job: any }> {
    const res = await fetch("/api/video-processing/enqueue", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error encolando video" }));
      throw new Error(err.detail || "Error encolando video");
    }
    return await res.json();
  },

  async enqueueBatch(payload: EnqueueBatchPayload): Promise<{ success: boolean; enqueued_count: number; jobs: any[] }> {
    const res = await fetch("/api/video-processing/enqueue-batch", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error encolando lote de sanitización" }));
      throw new Error(err.detail || "Error encolando lote de sanitización");
    }
    return await res.json();
  },

  async listJobs(): Promise<VideoProcessingJob[]> {
    try {
      const res = await fetch("/api/video-processing/jobs", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async cancelJob(jobId: string): Promise<boolean> {
    const res = await fetch(`/api/video-processing/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    return res.ok;
  },

  async deleteJob(jobId: string): Promise<boolean> {
    const res = await fetch(`/api/video-processing/jobs/${jobId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  },

  async retryJob(jobId: string): Promise<boolean> {
    const res = await fetch(`/api/video-processing/jobs/${jobId}/retry`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    return res.ok;
  },

  async detectWatermark(payload: {
    source_channel_id: number;
    source_message_id: number;
    account_id?: number | null;
  }): Promise<WatermarkDetectionResult> {
    const res = await fetch("/api/video-processing/detect", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error("Error ejecutando auto-detección de marca de agua");
    }
    return await res.json();
  },
};
