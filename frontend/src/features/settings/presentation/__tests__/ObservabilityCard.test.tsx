import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ObservabilityCard } from "../components/ObservabilityCard";
import { observabilityApi, SystemMetrics } from "../../infrastructure/observabilityApi";

vi.mock("../../infrastructure/observabilityApi", () => ({
  observabilityApi: {
    getMetrics: vi.fn(),
    getPrometheusText: vi.fn(),
    evaluateAnomalies: vi.fn(),
  },
}));

const mockMetrics: SystemMetrics = {
  uptime_seconds: 3600,
  memory_rss_bytes: 52428800, // 50MB
  jobs: {
    total: 10,
    by_status: {
      COMPLETED: 8,
      RUNNING: 1,
      FAILED: 1,
    },
    total_failovers: 4,
    total_processed_videos: 40,
    total_target_videos: 50,
  },
  deduplication: {
    fingerprints_indexed: 55,
    deduplicated_items: 22,
    saved_bytes: 26214400,
    saved_mb: 25.0,
  },
  mtproto_pool: {
    total_accounts: 3,
    online_accounts: 2,
    cooldown_accounts: 1,
  },
  rate_governor: {
    mode: "HIGH_SPEED",
    limit_bytes_per_sec: 5242880,
  },
};

describe("ObservabilityCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(observabilityApi.getMetrics).mockResolvedValue(mockMetrics);
  });

  it("renders metrics overview, MTProto pool stats and failover counters", async () => {
    render(<ObservabilityCard />);

    expect(screen.getByText("Observabilidad & Exportador Prometheus / OpenMetrics")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("4")).toBeInTheDocument(); // Hot Failovers
      expect(screen.getByText("25.0 MB")).toBeInTheDocument(); // Dedup Ahorro
      expect(screen.getByText("/metrics")).toBeInTheDocument();
    });
  });

  it("toggles prometheus.yml scrape configuration snippet", async () => {
    render(<ObservabilityCard />);

    await waitFor(() => {
      expect(screen.getByText("Ver prometheus.yml")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Ver prometheus.yml"));
    expect(screen.getByText("Ocultar prometheus.yml")).toBeInTheDocument();
    expect(screen.getByText(/scrape_configs:/)).toBeInTheDocument();
  });

  it("triggers anomaly scan and renders clean status feedback", async () => {
    vi.mocked(observabilityApi.evaluateAnomalies).mockResolvedValue({
      anomalies: [],
      count: 0,
      has_critical: false,
    });

    render(<ObservabilityCard />);

    await waitFor(() => {
      expect(screen.getByText("Escanear Anomalías")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Escanear Anomalías"));

    await waitFor(() => {
      expect(screen.getByText(/Sistema 100% saludable, sin anomalías/)).toBeInTheDocument();
    });
  });

  it("triggers anomaly scan and renders detected anomalies", async () => {
    vi.mocked(observabilityApi.evaluateAnomalies).mockResolvedValue({
      anomalies: [
        {
          code: "MTPROTO_COOLDOWN_ACTIVE",
          severity: "WARNING",
          title: "Aviso: Cuentas en Cooldown",
          message: "1 de 3 cuentas MTProto están en cooldown",
        },
      ],
      count: 1,
      has_critical: false,
    });

    render(<ObservabilityCard />);

    await waitFor(() => {
      expect(screen.getByText("Escanear Anomalías")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Escanear Anomalías"));

    await waitFor(() => {
      expect(screen.getByText("Anomalías Detectadas (1)")).toBeInTheDocument();
      expect(screen.getByText("Aviso: Cuentas en Cooldown:")).toBeInTheDocument();
    });
  });
});
