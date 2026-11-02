export type JobStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED"
  | "PAUSED_FLOOD_WAIT"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface JobItem {
  job_id: string;
  source_id: number;
  target_id: number;
  status: JobStatus;
  total_videos: number;
  processed_videos: number;
  last_processed_id: number | null;
  created_at: string | null;
  is_full_migration: boolean;
  source_title: string | null;
  target_title: string | null;
  source_account_id: number | null;
  target_account_id: number | null;
  caption_rules: Record<string, any> | null;
  drip_delay_seconds: number;
  media_filter_rules: Record<string, any> | null;
}

export interface QueueItem {
  job_id: string;
  source_message_id: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED";
  media_type: string;
  caption: string;
  target_message_id: number | null;
  error_message: string | null;
  retry_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface JobQueueStatus {
  job_id: string;
  stats: {
    total?: number;
    pending?: number;
    in_progress?: number;
    completed?: number;
    failed?: number;
    skipped?: number;
  };
  items: QueueItem[];
}

export interface JobListResponse {
  items: JobItem[];
  total: number;
  page: number;
  page_size: number;
}
