import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuditView } from "../AuditView";
import { auditApi } from "../../infrastructure/auditApi";
import { useAuditStore } from "../../application/useAuditStore";

vi.mock("../../infrastructure/auditApi", () => ({
  auditApi: {
    fetchAuditLogs: vi.fn(),
    exportAuditLogs: vi.fn(),
  },
}));

describe("AuditView Export Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuditStore.setState({
      logs: [
        {
          id: 1,
          user_id: 1,
          user_email: "admin@telegramhub.local",
          action: "LOGIN",
          resource: "auth:session",
          details: { ip: "127.0.0.1" },
          ip_address: "127.0.0.1",
          created_at: "2026-11-07T12:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      isLoading: false,
      error: null,
      selectedLog: null,
    });
  });

  it("renders export buttons in header toolbar", async () => {
    (auditApi.fetchAuditLogs as any).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      page_size: 25,
      total_pages: 1,
    });

    render(<AuditView />);

    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText("Imprimir / PDF")).toBeInTheDocument();
  });

  it("triggers CSV export when clicking CSV button", async () => {
    const mockBlob = new Blob(["id,action\n1,LOGIN"], { type: "text/csv" });
    (auditApi.exportAuditLogs as any).mockResolvedValueOnce(mockBlob);

    // Mock URL and DOM
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    window.URL.createObjectURL = createObjectURLMock;

    render(<AuditView />);

    const csvButton = screen.getByText("CSV");
    fireEvent.click(csvButton);

    await waitFor(() => {
      expect(auditApi.exportAuditLogs).toHaveBeenCalledWith({
        format: "csv",
        action: undefined,
        limit: 5000,
      });
      expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
    });
  });

  it("opens printable HTML report in new tab when clicking Imprimir / PDF", async () => {
    const mockHtmlBlob = new Blob(["<html><body>Audit Report</body></html>"], { type: "text/html" });
    (auditApi.exportAuditLogs as any).mockResolvedValueOnce(mockHtmlBlob);

    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-html-url");
    window.URL.createObjectURL = createObjectURLMock;
    const windowOpenMock = vi.fn();
    window.open = windowOpenMock;

    render(<AuditView />);

    const printButton = screen.getByText("Imprimir / PDF");
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(auditApi.exportAuditLogs).toHaveBeenCalledWith({
        format: "html",
        action: undefined,
        limit: 5000,
      });
      expect(windowOpenMock).toHaveBeenCalledWith("blob:mock-html-url", "_blank");
    });
  });
});
