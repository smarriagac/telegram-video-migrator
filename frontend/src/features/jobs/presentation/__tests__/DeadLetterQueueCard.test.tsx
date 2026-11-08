import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DeadLetterQueueCard } from "../components/DeadLetterQueueCard";
import { jobsApi, DLQSummary } from "../../infrastructure/jobsApi";
import { QueueItem } from "../../domain/types";

vi.mock("../../infrastructure/jobsApi", () => ({
  jobsApi: {
    fetchDLQ: vi.fn(),
    fetchDLQSummary: vi.fn(),
    retrySingleItem: vi.fn(),
    skipSingleItem: vi.fn(),
    updateItemCaption: vi.fn(),
    bulkRetryDLQ: vi.fn(),
    bulkSkipDLQ: vi.fn(),
    retryByFilterDLQ: vi.fn(),
    skipByFilterDLQ: vi.fn(),
  },
}));

const mockDLQItems: QueueItem[] = [
  {
    job_id: "job_dlq_test_12345",
    source_message_id: 101,
    status: "FAILED",
    media_type: "video",
    caption: "Original caption with bad link",
    target_message_id: null,
    error_message: "FloodWait: 42 seconds remaining",
    retry_count: 2,
    created_at: "2026-11-08T00:00:00Z",
    updated_at: "2026-11-08T00:00:00Z",
  },
  {
    job_id: "job_dlq_test_67890",
    source_message_id: 102,
    status: "FAILED",
    media_type: "photo",
    caption: "Image caption",
    target_message_id: null,
    error_message: "ChatWriteForbidden",
    retry_count: 1,
    created_at: "2026-11-08T00:05:00Z",
    updated_at: "2026-11-08T00:05:00Z",
  },
];

const mockSummary: DLQSummary = {
  total_failed: 2,
  by_category: {
    FLOOD_WAIT: 1,
    TIMEOUT_NETWORK: 0,
    PERMISSION_AUTH: 1,
    MEDIA_CORRUPT: 0,
    OTHER: 0,
  },
  by_media_type: {
    video: 1,
    photo: 1,
  },
};

describe("DeadLetterQueueCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jobsApi.fetchDLQSummary as any).mockResolvedValue(mockSummary);
  });

  it("renders empty state when no items exist in DLQ", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });
    (jobsApi.fetchDLQSummary as any).mockResolvedValue({
      total_failed: 0,
      by_category: { FLOOD_WAIT: 0, TIMEOUT_NETWORK: 0, PERMISSION_AUTH: 0, MEDIA_CORRUPT: 0, OTHER: 0 },
      by_media_type: {},
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(
        screen.getByText("No hay elementos fallidos con los filtros actuales")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("0 fallos")).toBeInTheDocument();
  });

  it("renders table with failed queue items and category pills", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: mockDLQItems,
      total: 2,
      limit: 50,
      offset: 0,
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeInTheDocument();
      expect(screen.getByText("#102")).toBeInTheDocument();
    });

    expect(screen.getByText("2 fallos")).toBeInTheDocument();
    expect(screen.getByText("FloodWait: 42 seconds remaining")).toBeInTheDocument();
    expect(screen.getByText("ChatWriteForbidden")).toBeInTheDocument();
    expect(screen.getByText("Caption: Original caption with bad link")).toBeInTheDocument();

    // Verify category pills
    expect(screen.getByText("FloodWait")).toBeInTheDocument();
    expect(screen.getByText("Permisos")).toBeInTheDocument();
  });

  it("handles granular item retry on clicking Reintentar", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: mockDLQItems,
      total: 2,
      limit: 50,
      offset: 0,
    });
    (jobsApi.retrySingleItem as any).mockResolvedValue({
      success: true,
      status: "PENDING",
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeInTheDocument();
    });

    const retryButtons = screen.getAllByRole("button", { name: /^reintentar$/i });
    fireEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(jobsApi.retrySingleItem).toHaveBeenCalledWith("job_dlq_test_12345", 101);
    });
  });

  it("handles granular item skip on clicking Omitir", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: mockDLQItems,
      total: 2,
      limit: 50,
      offset: 0,
    });
    (jobsApi.skipSingleItem as any).mockResolvedValue({
      success: true,
      status: "SKIPPED",
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeInTheDocument();
    });

    const skipButtons = screen.getAllByRole("button", { name: /^omitir$/i });
    fireEvent.click(skipButtons[0]);

    await waitFor(() => {
      expect(jobsApi.skipSingleItem).toHaveBeenCalledWith("job_dlq_test_12345", 101);
    });
  });

  it("handles 1-Click retry by filter action", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: mockDLQItems,
      total: 2,
      limit: 50,
      offset: 0,
    });
    (jobsApi.retryByFilterDLQ as any).mockResolvedValue({
      success: true,
      retried_count: 2,
      resumed_jobs: ["job_dlq_test_12345"],
      filter: {},
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(screen.getByText(/Reintentar Filtro \(2\)/)).toBeInTheDocument();
    });

    const oneClickBtn = screen.getByText(/Reintentar Filtro \(2\)/);
    fireEvent.click(oneClickBtn);

    await waitFor(() => {
      expect(jobsApi.retryByFilterDLQ).toHaveBeenCalledTimes(1);
    });
  });

  it("handles bulk selection and bulk retry of selected items", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: mockDLQItems,
      total: 2,
      limit: 50,
      offset: 0,
    });
    (jobsApi.bulkRetryDLQ as any).mockResolvedValue({
      success: true,
      retried_count: 2,
      total_requested: 2,
      resumed_jobs: ["job_dlq_test_12345", "job_dlq_test_67890"],
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeInTheDocument();
    });

    const masterCheckbox = screen.getByLabelText("Seleccionar todos los visibles");
    fireEvent.click(masterCheckbox);

    await waitFor(() => {
      expect(screen.getByText("2 elementos seleccionados")).toBeInTheDocument();
    });

    const bulkRetryBtn = screen.getByRole("button", { name: /reintentar \(2\)/i });
    fireEvent.click(bulkRetryBtn);

    await waitFor(() => {
      expect(jobsApi.bulkRetryDLQ).toHaveBeenCalledWith([
        { job_id: "job_dlq_test_12345", source_message_id: 101 },
        { job_id: "job_dlq_test_67890", source_message_id: 102 },
      ]);
    });
  });

  it("handles bulk skip of selected items", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: mockDLQItems,
      total: 2,
      limit: 50,
      offset: 0,
    });
    (jobsApi.bulkSkipDLQ as any).mockResolvedValue({
      success: true,
      skipped_count: 2,
      total_requested: 2,
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeInTheDocument();
    });

    const masterCheckbox = screen.getByLabelText("Seleccionar todos los visibles");
    fireEvent.click(masterCheckbox);

    await waitFor(() => {
      expect(screen.getByText("2 elementos seleccionados")).toBeInTheDocument();
    });

    const bulkSkipBtn = screen.getByRole("button", { name: /omitir \(2\)/i });
    fireEvent.click(bulkSkipBtn);

    await waitFor(() => {
      expect(jobsApi.bulkSkipDLQ).toHaveBeenCalledWith([
        { job_id: "job_dlq_test_12345", source_message_id: 101 },
        { job_id: "job_dlq_test_67890", source_message_id: 102 },
      ]);
    });
  });
});
