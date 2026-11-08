export interface DoctorReport {
  overall_status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  timestamp: string;
  checks: {
    database: {
      status: "HEALTHY" | "DEGRADED" | "CRITICAL";
      latency_ms: number;
      driver: string;
      error?: string | null;
    };
    telegram_mtproto: {
      status: "HEALTHY" | "DEGRADED" | "CRITICAL";
      accounts_registered: number;
      accounts_active: number;
      clients_in_pool: number;
      clients_connected: number;
      error?: string | null;
    };
    media_engine: {
      status: "HEALTHY" | "DEGRADED" | "CRITICAL";
      ffmpeg_available: boolean;
      ffmpeg_path: string;
      ffmpeg_version: string;
      ffprobe_available: boolean;
      ffprobe_path: string;
      error?: string | null;
    };
    storage: {
      status: "HEALTHY" | "DEGRADED" | "CRITICAL";
      scratch_path: string;
      total_gb: number;
      used_gb: number;
      free_gb: number;
      used_percent: number;
      scratch_files_count: number;
      scratch_files_mb: number;
      error?: string | null;
    };
    background_services: {
      status: "HEALTHY" | "DEGRADED" | "CRITICAL";
      rate_governor: {
        status: string;
        total_managed_channels: number;
        active_throttles: number;
        frozen_channels: number;
      };
      event_broadcaster: {
        status: string;
        active_subscribers: number;
      };
    };
  };
  recommendations: string[];
}

export interface RemediationResponse {
  remediated: boolean;
  action: string;
  message: string;
  files_deleted?: number;
  bytes_freed?: number;
  freed_mb?: number;
  clients_in_pool?: number;
  avg_latency_ms?: number;
  samples_ms?: number[];
}

const API_BASE = "/api/health/doctor";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const doctorApi = {
  async getDoctorReport(): Promise<DoctorReport> {
    const res = await fetch(API_BASE, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch doctor diagnostic report (${res.status})`);
    }
    return res.json();
  },

  async remediate(action: string): Promise<RemediationResponse> {
    const res = await fetch(`${API_BASE}/remediate`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown remediation error" }));
      throw new Error(err.detail || `Remediation failed (${res.status})`);
    }
    return res.json();
  },
};
