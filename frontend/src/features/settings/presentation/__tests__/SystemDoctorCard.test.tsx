import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SystemDoctorCard } from "../components/SystemDoctorCard";
import { doctorApi, DoctorReport } from "../../infrastructure/doctorApi";

vi.mock("../../infrastructure/doctorApi", () => ({
  doctorApi: {
    getDoctorReport: vi.fn(),
    remediate: vi.fn(),
  },
}));

const mockHealthyReport: DoctorReport = {
  overall_status: "HEALTHY",
  timestamp: "2026-11-08T05:20:00Z",
  checks: {
    database: {
      status: "HEALTHY",
      latency_ms: 1.85,
      driver: "PostgreSQL (asyncpg connection pool)",
      error: null,
    },
    telegram_mtproto: {
      status: "HEALTHY",
      accounts_registered: 2,
      accounts_active: 2,
      clients_in_pool: 2,
      clients_connected: 2,
      error: null,
    },
    media_engine: {
      status: "HEALTHY",
      ffmpeg_available: true,
      ffmpeg_path: "/usr/bin/ffmpeg",
      ffmpeg_version: "ffmpeg version 6.1.1",
      ffprobe_available: true,
      ffprobe_path: "/usr/bin/ffprobe",
      error: null,
    },
    storage: {
      status: "HEALTHY",
      scratch_path: "/tmp",
      total_gb: 100.0,
      used_gb: 25.0,
      free_gb: 75.0,
      used_percent: 25.0,
      scratch_files_count: 3,
      scratch_files_mb: 45.2,
      error: null,
    },
    background_services: {
      status: "HEALTHY",
      rate_governor: {
        status: "RUNNING",
        total_managed_channels: 4,
        active_throttles: 0,
        frozen_channels: 0,
      },
      event_broadcaster: {
        status: "RUNNING",
        active_subscribers: 2,
      },
    },
  },
  recommendations: [
    "Todos los subsistemas se encuentran en estado óptimo.",
  ],
};

const mockDegradedReport: DoctorReport = {
  ...mockHealthyReport,
  overall_status: "DEGRADED",
  checks: {
    ...mockHealthyReport.checks,
    database: {
      status: "DEGRADED",
      latency_ms: 145.0,
      driver: "In-Memory Fallback Adapter",
      error: "Postgres connection timeout",
    },
  },
  recommendations: [
    "Conexión con PostgreSQL caída; el sistema opera en modo memoria volátil.",
  ],
};

describe("SystemDoctorCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders healthy diagnostic status and subsystems", async () => {
    (doctorApi.getDoctorReport as any).mockResolvedValue(mockHealthyReport);

    render(<SystemDoctorCard />);

    await waitFor(() => {
      expect(screen.getByText("Doctor del Sistema y Sondas de Salud")).toBeInTheDocument();
      expect(screen.getByText("Saludable")).toBeInTheDocument();
      expect(screen.getByText("1.85 ms")).toBeInTheDocument();
      expect(screen.getByText("ffmpeg version 6.1.1")).toBeInTheDocument();
      expect(screen.getByText("75 GB / 100 GB")).toBeInTheDocument();
    });
  });

  it("renders degraded badge when database has high latency or is in fallback mode", async () => {
    (doctorApi.getDoctorReport as any).mockResolvedValue(mockDegradedReport);

    render(<SystemDoctorCard />);

    await waitFor(() => {
      expect(screen.getByText("Degradado")).toBeInTheDocument();
      expect(screen.getByText("145 ms")).toBeInTheDocument();
      expect(screen.getByText(/Conexión con PostgreSQL caída/)).toBeInTheDocument();
    });
  });

  it("executes remediation action and displays confirmation message", async () => {
    (doctorApi.getDoctorReport as any).mockResolvedValue(mockHealthyReport);
    (doctorApi.remediate as any).mockResolvedValue({
      remediated: true,
      action: "clean_temp_storage",
      message: "Se eliminaron 3 archivos temporales (45.2 MB liberados).",
      files_deleted: 3,
      bytes_freed: 47395840,
    });

    render(<SystemDoctorCard />);

    await waitFor(() => {
      expect(screen.getByText("Limpiar Temporales")).toBeInTheDocument();
    });

    const cleanButton = screen.getByText("Limpiar Temporales");
    fireEvent.click(cleanButton);

    await waitFor(() => {
      expect(doctorApi.remediate).toHaveBeenCalledWith("clean_temp_storage");
      expect(screen.getByText("Se eliminaron 3 archivos temporales (45.2 MB liberados).")).toBeInTheDocument();
    });
  });

  it("triggers manual probe refresh on button click", async () => {
    (doctorApi.getDoctorReport as any).mockResolvedValue(mockHealthyReport);

    render(<SystemDoctorCard />);

    await waitFor(() => {
      expect(screen.getByText("Ejecutar Diagnóstico")).toBeInTheDocument();
    });

    const refreshBtn = screen.getByText("Ejecutar Diagnóstico");
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(doctorApi.getDoctorReport).toHaveBeenCalledTimes(2);
    });
  });
});
