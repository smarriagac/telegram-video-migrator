import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobQueueModal } from "../components/JobQueueModal";
import { JobItem, JobQueueStatus } from "../../domain/types";

const mockJob: JobItem = {
  job_id: "test-job-modal-12345",
  source_id: -100111222,
  target_id: -100333444,
  status: "RUNNING",
  total_videos: 10,
  processed_videos: 5,
  last_processed_id: 105,
  created_at: "2026-11-08T00:00:00Z",
  scheduled_at: null,
  is_full_migration: true,
  source_title: "Canal Fuente",
  target_title: "Canal Destino",
  source_account_id: 1,
  target_account_id: 2,
  caption_rules: null,
  drip_delay_seconds: 0,
  media_filter_rules: null,
};

const mockQueueStatus: JobQueueStatus = {
  job_id: "test-job-modal-12345",
  stats: {
    total: 2,
    pending: 0,
    in_progress: 0,
    completed: 2,
    failed: 0,
    skipped: 0,
    deduplicated: 1,
  },
  items: [
    {
      job_id: "test-job-modal-12345",
      source_message_id: 101,
      status: "COMPLETED",
      media_type: "video",
      caption: "Standard migrated video",
      target_message_id: 501,
      error_message: null,
      retry_count: 0,
      created_at: "2026-11-08T00:00:00Z",
      updated_at: "2026-11-08T00:00:00Z",
      is_deduplicated: false,
    },
    {
      job_id: "test-job-modal-12345",
      source_message_id: 102,
      status: "COMPLETED",
      media_type: "video",
      caption: "Fast-forwarded duplicate video",
      target_message_id: 502,
      error_message: "Fast-Forward: Ya existe en destino",
      retry_count: 0,
      created_at: "2026-11-08T00:01:00Z",
      updated_at: "2026-11-08T00:01:00Z",
      is_deduplicated: true,
    },
  ],
};

describe("JobQueueModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with queue items and Fast-Forward deduplication badge", () => {
    render(
      <JobQueueModal
        job={mockJob}
        queueStatus={mockQueueStatus}
        isLoading={false}
        onClose={vi.fn()}
        onRetryFailed={vi.fn()}
      />
    );

    expect(screen.getByText("Canal Fuente")).toBeInTheDocument();
    expect(screen.getByText("Canal Destino")).toBeInTheDocument();
    expect(screen.getByText("Standard migrated video")).toBeInTheDocument();
    expect(screen.getByText("Fast-Forward: Ya existe en destino")).toBeInTheDocument();

    // Verify Fast-Forward badge
    expect(screen.getByText("Fast-Forward")).toBeInTheDocument();

    // Verify Dedup counter in stats bar
    expect(screen.getByText("Dedup")).toBeInTheDocument();
  });
});
