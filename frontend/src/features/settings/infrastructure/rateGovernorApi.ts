export interface ChannelThrottle {
  account_id: number | string | null;
  target_id: string;
  capacity: number;
  tokens: number;
  refill_rate: number;
  backoff_multiplier: number;
  consecutive_successes: number;
  consecutive_failures: number;
  remaining_freeze_seconds: number;
  total_dispatches: number;
  total_flood_waits: number;
  ema_latency_ms: number;
  status: "HEALTHY" | "THROTTLED" | "FROZEN";
}

export interface BandwidthTelemetry {
  limit_bytes_per_sec: number;
  limit_mb_per_sec: number;
  is_unlimited: boolean;
  current_rate_mb_per_sec: number;
  current_rate_bytes_per_sec: number;
  total_bytes_transferred: number;
  total_mb_transferred: number;
}

export interface RateGovernorStatus {
  total_managed_channels: number;
  active_throttles: number;
  frozen_channels: number;
  channels: ChannelThrottle[];
  bandwidth?: BandwidthTelemetry;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const rateGovernorApi = {
  async getStatus(): Promise<RateGovernorStatus> {
    const res = await fetch(`${API_BASE_URL}/system/rate-governor`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al obtener estado del gobernador de tasa");
    }
    return res.json();
  },

  async resetChannel(targetId?: string, accountId?: number | string | null): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/system/rate-governor/reset`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_id: targetId || null,
        account_id: accountId || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al reiniciar gobernador de tasa");
    }
    return res.json();
  },

  async getBandwidthStatus(): Promise<BandwidthTelemetry> {
    const res = await fetch(`${API_BASE_URL}/system/rate-governor/bandwidth`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al obtener estado de ancho de banda");
    }
    return res.json();
  },

  async updateBandwidthLimit(limitMbPerSec: number | null): Promise<BandwidthTelemetry> {
    const res = await fetch(`${API_BASE_URL}/system/rate-governor/bandwidth`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit_mb_per_sec: limitMbPerSec }),
    });
    if (!res.ok) {
      throw new Error("Error al actualizar límite de ancho de banda");
    }
    return res.json();
  },
};
