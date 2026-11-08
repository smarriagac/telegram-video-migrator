export interface SystemMetrics {
  uptime_seconds: number;
  memory_rss_bytes: number;
  jobs: {
    total: number;
    by_status: Record<string, number>;
    total_failovers: number;
    total_processed_videos: number;
    total_target_videos: number;
  };
  deduplication: {
    fingerprints_indexed: number;
    deduplicated_items: number;
    saved_bytes: number;
    saved_mb: number;
  };
  mtproto_pool: {
    total_accounts: number;
    online_accounts: number;
    cooldown_accounts: number;
  };
  rate_governor: {
    mode: string;
    limit_bytes_per_sec: number;
  };
}

export interface AnomalyItem {
  code: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  title: string;
  message: string;
}

export interface AnomalyCheckResult {
  anomalies: AnomalyItem[];
  count: number;
  has_critical: boolean;
}

export const observabilityApi = {
  async getMetrics(): Promise<SystemMetrics> {
    const res = await fetch("/api/system/metrics");
    if (!res.ok) {
      throw new Error(`Failed to fetch metrics: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getPrometheusText(): Promise<string> {
    const res = await fetch("/metrics");
    if (!res.ok) {
      throw new Error(`Failed to scrape Prometheus metrics: HTTP ${res.status}`);
    }
    return res.text();
  },

  async evaluateAnomalies(dispatch: boolean = true): Promise<AnomalyCheckResult> {
    const res = await fetch(`/api/system/metrics/anomalies/evaluate?dispatch=${dispatch}`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(`Failed to evaluate anomalies: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getGrafanaDashboard(): Promise<any> {
    const res = await fetch("/api/system/metrics/grafana-dashboard");
    if (!res.ok) {
      throw new Error(`Failed to fetch Grafana dashboard: HTTP ${res.status}`);
    }
    return res.json();
  },

  getGrafanaDashboardDownloadUrl(): string {
    return "/api/system/metrics/grafana-dashboard?download=true";
  },
};
