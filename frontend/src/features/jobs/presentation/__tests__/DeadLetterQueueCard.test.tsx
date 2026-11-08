import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DeadLetterQueueCard } from "../components/DeadLetterQueueCard";
import { jobsApi } from "../../infrastructure/jobsApi";
import { QueueItem } from "../../domain/types";

vi.mock("../../infrastructure/jobsApi", () => ({
  jobsApi: {
    fetchDLQ: vi.fn(),
    retrySingleItem: vi.fn(),
    skipSingleItem: vi.fn(),
    updateItemCaption: vi.fn(),
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

describe("DeadLetterQueueCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no items exist in DLQ", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(
        screen.getByText("La Dead-Letter Queue está limpia.")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("0 fallos")).toBeInTheDocument();
  });

  it("renders table with failed queue items and error details", async () => {
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
    expect(screen.getByText("Original caption with bad link")).toBeInTheDocument();
    expect(screen.getByText("2 veces")).toBeInTheDocument();
    expect(screen.getByText("1 vez")).toBeInTheDocument();
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

    const retryButtons = screen.getAllByRole("button", { name: /reintentar/i });
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

    const skipButtons = screen.getAllByRole("button", { name: /omitir/i });
    fireEvent.click(skipButtons[0]);

    await waitFor(() => {
      expect(jobsApi.skipSingleItem).toHaveBeenCalledWith("job_dlq_test_12345", 101);
    });
  });

  it("opens caption edit dialog and updates item caption", async () => {
    (jobsApi.fetchDLQ as any).mockResolvedValue({
      items: mockDLQItems,
      total: 2,
      limit: 50,
      offset: 0,
    });
    (jobsApi.updateItemCaption as any).mockResolvedValue({
      success: true,
      caption: "Fixed clean caption",
    });

    render(<DeadLetterQueueCard />);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeInTheDocument();
    });

    // The edit button has an Edit3 icon inside a ghost button
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-edit-3") !== null
    );
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Editar Caption del Mensaje #101")).toBeInTheDocument();
    });

    const textarea = screen.getByDisplayValue("Original caption with bad link");
    fireEvent.change(textarea, { target: { value: "Fixed clean caption" } });

    const saveButton = screen.getByRole("button", { name: /guardar caption/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(jobsApi.updateItemCaption).toHaveBeenCalledWith(
        "job_dlq_test_12345",
        101,
        "Fixed clean caption"
      );
    });
  });
});
