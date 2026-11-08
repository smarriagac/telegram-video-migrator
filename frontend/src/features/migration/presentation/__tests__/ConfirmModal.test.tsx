import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ConfirmModal } from "../components/ConfirmModal";
import { useMigrationStore } from "../../application/useMigrationStore";
import { migrationApi } from "../../infrastructure/migrationApi";

vi.mock("../../infrastructure/migrationApi", () => ({
  migrationApi: {
    checkPreFlight: vi.fn(),
  },
}));

describe("ConfirmModal with PreFlight Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMigrationStore.setState({
      channels: [
        { id: 101, title: "Canal A", can_post: true } as any,
        { id: 202, title: "Canal B", can_post: true } as any,
      ],
      selectedSourceId: 101,
      selectedTargetId: 202,
      selectedMessageIds: [1, 2, 3],
      isStartingJob: false,
      scheduledAt: null,
      dripDelaySeconds: 1,
    });
  });

  it("fetches and renders pre-flight simulation results when open", async () => {
    (migrationApi.checkPreFlight as any).mockResolvedValueOnce({
      can_proceed: true,
      total_requested_items: 3,
      already_cloned_items: 1,
      new_items_to_migrate: 2,
      target_writable: true,
      account_ready: true,
      cooldown_seconds: 0,
      estimated_disk_required_mb: 60.0,
      disk_space_available_mb: 5000.0,
      estimated_duration_seconds: 12,
      warnings: ["1 mensaje ya existe en el destino"],
      errors: [],
    });

    render(<ConfirmModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Listo para Iniciar")).toBeInTheDocument();
      expect(screen.getByText("1 mensaje ya existe en el destino")).toBeInTheDocument();
      expect(screen.getByText("12s")).toBeInTheDocument();
    });
  });

  it("disables confirm button when pre-flight is blocked by errors", async () => {
    (migrationApi.checkPreFlight as any).mockResolvedValueOnce({
      can_proceed: false,
      total_requested_items: 2,
      already_cloned_items: 0,
      new_items_to_migrate: 2,
      target_writable: false,
      account_ready: true,
      cooldown_seconds: 0,
      estimated_disk_required_mb: 60.0,
      disk_space_available_mb: 5000.0,
      estimated_duration_seconds: 8,
      warnings: [],
      errors: ["La cuenta no tiene permisos de publicación ('can_post')"],
    });

    render(<ConfirmModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Bloqueado")).toBeInTheDocument();
      expect(
        screen.getByText("La cuenta no tiene permisos de publicación ('can_post')")
      ).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /bloqueado por pre-flight/i });
    expect(confirmBtn).toBeDisabled();
  });
});
