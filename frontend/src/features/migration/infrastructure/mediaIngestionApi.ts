import { useAuthStore } from "@/features/auth/application/useAuthStore";

export interface IngestionMetadata {
  success: boolean;
  platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook" | "generic" | string;
  title: string;
  uploader?: string;
  duration: number;
  thumbnail?: string;
  width?: number;
  height?: number;
  webpage_url?: string;
  error?: string;
}

export interface AspectRatioPreset {
  id: "ORIGINAL" | "9:16_BLUR" | "9:16_CROP" | string;
  label: string;
  description: string;
}

export interface StageIngestionPayload {
  url: string;
  target_channel_id: number;
  mode?: "DIRECT" | "RESERVOIR";
  caption_override?: string | null;
  aspect_ratio_mode?: "ORIGINAL" | "9:16_BLUR" | "9:16_CROP" | string;
  branding_text?: string | null;
  account_id?: number | null;
  campaign_id?: string | null;
}

export interface IngestionResponse {
  success: boolean;
  mode: string;
  target_channel_id: number;
  message_id?: number;
  meta?: IngestionMetadata;
  aspect_ratio_mode?: string;
  error?: string;
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

export const mediaIngestionApi = {
  async inspectUrl(url: string): Promise<IngestionMetadata> {
    const res = await fetch("/api/ingestion/inspect", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al inspeccionar la URL.");
    }
    return res.json();
  },

  async stage(payload: StageIngestionPayload): Promise<IngestionResponse> {
    const res = await fetch("/api/ingestion/stage", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al procesar la ingesta del medio.");
    }
    return res.json();
  },

  async getAspectRatioPresets(): Promise<AspectRatioPreset[]> {
    const res = await fetch("/api/video-processing/aspect-ratios", {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      return [
        { id: "ORIGINAL", label: "Original", description: "Conserva resolución original" },
        { id: "9:16_BLUR", label: "Stories 9:16 (Fondo Borroso)", description: "Lienzo vertical con fondo dinámico difuminado" },
        { id: "9:16_CROP", label: "Stories 9:16 (Recorte Centrado)", description: "Recorte directo vertical centrado" },
      ];
    }
    const data = await res.json();
    return data.aspect_ratios || [];
  },
};
