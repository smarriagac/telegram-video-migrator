import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BackupManagerCard } from "../components/BackupManagerCard";
import { backupsApi } from "../../infrastructure/backupsApi";

vi.mock("../../infrastructure/backupsApi", () => ({
  backupsApi: {
    listBackups: vi.fn(),
    createBackup: vi.fn(),
    verifyBackup: vi.fn(),
    deleteBackup: vi.fn(),
    getDownloadUrl: vi.fn((id: string) => `/api/backups/${id}/download`),
  },
}));

describe("BackupManagerCard (Disaster Recovery)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no backups exist", async () => {
    (backupsApi.listBackups as any).mockResolvedValueOnce({
      snapshots: [],
      total_count: 0,
      total_size_bytes: 0,
      retention_limit: 7,
    });

    render(<BackupManagerCard />);

    await waitFor(() => {
      expect(
        screen.getByText("No hay copias de seguridad registradas")
      ).toBeInTheDocument();
      expect(screen.getByText("Crear Snapshot Ahora")).toBeInTheDocument();
    });
  });

  it("renders list of backups and summary stats", async () => {
    (backupsApi.listBackups as any).mockResolvedValueOnce({
      snapshots: [
        {
          snapshot_id: "snapshot_20261107_120000_abc123",
          filename: "snapshot_20261107_120000_abc123.tar.gz",
          created_at: "2026-11-07T12:00:00Z",
          trigger: "MANUAL",
          size_bytes: 1048576, // 1 MB
          total_records: 42,
          sha256: "fakehash123",
        },
      ],
      total_count: 1,
      total_size_bytes: 1048576,
      retention_limit: 7,
    });

    render(<BackupManagerCard />);

    await waitFor(() => {
      expect(screen.getByText("snapshot_20261107_120000_abc123")).toBeInTheDocument();
      expect(screen.getAllByText("1 MB").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("MANUAL")).toBeInTheDocument();
    });
  });

  it("triggers manual backup creation on button click", async () => {
    (backupsApi.listBackups as any).mockResolvedValueOnce({
      snapshots: [],
      total_count: 0,
      total_size_bytes: 0,
      retention_limit: 7,
    });

    (backupsApi.createBackup as any).mockResolvedValueOnce({
      snapshot_id: "snapshot_20261107_130000_new999",
      filename: "snapshot_20261107_130000_new999.tar.gz",
      created_at: "2026-11-07T13:00:00Z",
      trigger: "MANUAL",
      size_bytes: 204800,
      total_records: 15,
      sha256: "newhash456",
    });

    render(<BackupManagerCard />);

    await waitFor(() => {
      expect(screen.getByText("Crear Snapshot Ahora")).toBeInTheDocument();
    });

    const createBtn = screen.getByText("Crear Snapshot Ahora");
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(backupsApi.createBackup).toHaveBeenCalledWith({ trigger: "MANUAL" });
      expect(screen.getByText("snapshot_20261107_130000_new999")).toBeInTheDocument();
      expect(
        screen.getByText("Snapshot snapshot_20261107_130000_new999 generado correctamente.")
      ).toBeInTheDocument();
    });
  });

  it("verifies backup integrity on demand", async () => {
    (backupsApi.listBackups as any).mockResolvedValueOnce({
      snapshots: [
        {
          snapshot_id: "snapshot_test_verify",
          filename: "snapshot_test_verify.tar.gz",
          created_at: "2026-11-07T12:00:00Z",
          trigger: "MANUAL",
          size_bytes: 512000,
          total_records: 20,
        },
      ],
      total_count: 1,
      total_size_bytes: 512000,
      retention_limit: 7,
    });

    (backupsApi.verifyBackup as any).mockResolvedValueOnce({
      valid: true,
      snapshot_id: "snapshot_test_verify",
      manifest: {
        snapshot_id: "snapshot_test_verify",
        total_records: 20,
      },
      has_tables_dump: true,
      sha256: "abcdef12345678901234567890",
      size_bytes: 512000,
    });

    render(<BackupManagerCard />);

    await waitFor(() => {
      expect(screen.getByText("Verificar")).toBeInTheDocument();
    });

    const verifyBtn = screen.getByText("Verificar");
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(backupsApi.verifyBackup).toHaveBeenCalledWith("snapshot_test_verify");
      expect(
        screen.getByText(/Verificación de Integridad Exitosa: snapshot_test_verify/i)
      ).toBeInTheDocument();
    });
  });
});
