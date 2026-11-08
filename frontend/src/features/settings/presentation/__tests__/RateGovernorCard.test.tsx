import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RateGovernorCard } from "../components/RateGovernorCard";
import { rateGovernorApi, RateGovernorStatus } from "../../infrastructure/rateGovernorApi";

vi.mock("../../infrastructure/rateGovernorApi", () => ({
  rateGovernorApi: {
    getStatus: vi.fn(),
    resetChannel: vi.fn(),
    getBandwidthStatus: vi.fn(),
    updateBandwidthLimit: vi.fn(),
  },
}));

const mockStatus: RateGovernorStatus = {
  total_managed_channels: 2,
  active_throttles: 1,
  frozen_channels: 1,
  bandwidth: {
    limit_bytes_per_sec: 0,
    limit_mb_per_sec: 0,
    is_unlimited: true,
    current_rate_mb_per_sec: 4.2,
    current_rate_bytes_per_sec: 4404019,
    total_bytes_transferred: 52428800,
    total_mb_transferred: 50.0,
  },
  channels: [
    {
      account_id: 1,
      target_id: "-1001234567890",
      capacity: 5.0,
      tokens: 3.5,
      refill_rate: 0.5,
      backoff_multiplier: 1.5,
      consecutive_successes: 0,
      consecutive_failures: 2,
      remaining_freeze_seconds: 14.2,
      total_dispatches: 45,
      total_flood_waits: 2,
      ema_latency_ms: 180.5,
      status: "FROZEN",
    },
    {
      account_id: 2,
      target_id: "-1009876543210",
      capacity: 5.0,
      tokens: 5.0,
      refill_rate: 0.5,
      backoff_multiplier: 1.0,
      consecutive_successes: 12,
      consecutive_failures: 0,
      remaining_freeze_seconds: 0.0,
      total_dispatches: 120,
      total_flood_waits: 0,
      ema_latency_ms: 45.2,
      status: "HEALTHY",
    },
  ],
};

describe("RateGovernorCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no channels are throttled or tracked", async () => {
    (rateGovernorApi.getStatus as any).mockResolvedValue({
      total_managed_channels: 0,
      active_throttles: 0,
      frozen_channels: 0,
      channels: [],
    });

    render(<RateGovernorCard />);

    await waitFor(() => {
      expect(
        screen.getByText("Sin congestión detectada en canales.")
      ).toBeInTheDocument();
    });
  });

  it("renders KPI metrics and active channel throttle table", async () => {
    (rateGovernorApi.getStatus as any).mockResolvedValue(mockStatus);

    render(<RateGovernorCard />);

    await waitFor(() => {
      expect(screen.getByText("-1001234567890")).toBeInTheDocument();
      expect(screen.getByText("-1009876543210")).toBeInTheDocument();
    });

    expect(screen.getByText("CONGELADO (14.2s)")).toBeInTheDocument();
    expect(screen.getByText("SALUDABLE")).toBeInTheDocument();
    expect(screen.getByText("1.50x")).toBeInTheDocument();
    expect(screen.getByText("180.5 ms")).toBeInTheDocument();
    expect(screen.getByText("3.5 / 5")).toBeInTheDocument();
  });

  it("handles resetting a single channel", async () => {
    (rateGovernorApi.getStatus as any).mockResolvedValue(mockStatus);
    (rateGovernorApi.resetChannel as any).mockResolvedValue({
      success: true,
      message: "Channel reset",
    });

    render(<RateGovernorCard />);

    await waitFor(() => {
      expect(screen.getByText("-1001234567890")).toBeInTheDocument();
    });

    const resetButtons = screen.getAllByRole("button", { name: /reset/i });
    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(rateGovernorApi.resetChannel).toHaveBeenCalledWith("-1001234567890", 1);
    });
  });

  it("handles resetting all channels via Restablecer Todos", async () => {
    (rateGovernorApi.getStatus as any).mockResolvedValue(mockStatus);
    (rateGovernorApi.resetChannel as any).mockResolvedValue({
      success: true,
      message: "All channels reset",
    });

    render(<RateGovernorCard />);

    await waitFor(() => {
      expect(screen.getByText("-1001234567890")).toBeInTheDocument();
    });

    const resetAllBtn = screen.getByRole("button", { name: /restablecer todos/i });
    fireEvent.click(resetAllBtn);

    await waitFor(() => {
      expect(rateGovernorApi.resetChannel).toHaveBeenCalledWith();
    });
  });

  it("filters channels by status filter buttons", async () => {
    (rateGovernorApi.getStatus as any).mockResolvedValue(mockStatus);

    render(<RateGovernorCard />);

    await waitFor(() => {
      expect(screen.getByText("-1001234567890")).toBeInTheDocument();
      expect(screen.getByText("-1009876543210")).toBeInTheDocument();
    });

    const frozenFilterBtn = screen.getByRole("button", { name: "FROZEN" });
    fireEvent.click(frozenFilterBtn);

    await waitFor(() => {
      expect(screen.getByText("-1001234567890")).toBeInTheDocument();
      expect(screen.queryByText("-1009876543210")).not.toBeInTheDocument();
    });
  });

  it("renders bandwidth shaper telemetry and handles changing limit preset", async () => {
    (rateGovernorApi.getStatus as any).mockResolvedValue(mockStatus);
    (rateGovernorApi.updateBandwidthLimit as any).mockResolvedValue({
      limit_bytes_per_sec: 10 * 1024 * 1024,
      limit_mb_per_sec: 10,
      is_unlimited: false,
      current_rate_mb_per_sec: 4.2,
      current_rate_bytes_per_sec: 4404019,
      total_bytes_transferred: 52428800,
      total_mb_transferred: 50.0,
    });

    render(<RateGovernorCard />);

    await waitFor(() => {
      expect(
        screen.getByText("Modelado de Ancho de Banda de Red (Bandwidth Shaper)")
      ).toBeInTheDocument();
      expect(screen.getByText("4.2 MB/s")).toBeInTheDocument();
      expect(screen.getByText("50 MB")).toBeInTheDocument();
    });

    const preset10Btn = screen.getByRole("button", { name: /10 MB\/s/i });
    fireEvent.click(preset10Btn);

    await waitFor(() => {
      expect(rateGovernorApi.updateBandwidthLimit).toHaveBeenCalledWith(10);
      expect(
        screen.getByText("Límite de ancho de banda fijado en 10 MB/s.")
      ).toBeInTheDocument();
    });
  });
});
