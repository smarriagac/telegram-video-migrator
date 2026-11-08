const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface SimulateRulesPayload {
  sample_caption: string;
  caption_rules?: {
    strip_links?: boolean;
    strip_all_mentions?: boolean;
    replace_mentions?: Record<string, string>;
    remove_words?: string[];
    prepend_header?: string | null;
    append_signature?: string | null;
  };
  video_width?: number;
  video_height?: number;
  filter_type?: string;
  filter_params?: Record<string, any>;
}

export interface SimulationResult {
  success: boolean;
  caption: {
    original_caption: string;
    transformed_caption: string;
    original_length: number;
    transformed_length: number;
    delta_length: number;
    urls_detected: number;
    mentions_detected: number;
    words_removed_count: number;
  };
  delogo: {
    preset: string;
    x: number;
    y: number;
    w: number;
    h: number;
    x_pct: number;
    y_pct: number;
    w_pct: number;
    h_pct: number;
  };
  watermark: {
    text: string;
    position: string;
    font_size: number;
    font_color: string;
    with_box: boolean;
    margin: number;
    preview_x_pct: number;
    preview_y_pct: number;
  };
  video_dimensions: {
    width: number;
    height: number;
    aspect_ratio: string;
  };
  filter_type: string;
  ffmpeg_args: string[];
  ffmpeg_filter_string: string;
}

export const rulesPlaygroundApi = {
  async simulateRules(payload: SimulateRulesPayload): Promise<SimulationResult> {
    const res = await fetch(`${API_BASE_URL}/video-processing/simulate`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al simular reglas de procesamiento");
    }
    return res.json();
  },
};
