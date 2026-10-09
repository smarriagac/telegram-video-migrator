export type JobStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED_FLOOD_WAIT"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Channel {
  id: number;
  title: string;
  username: string | null;
  can_post: boolean;
}

export interface MigrationJob {
  job_id: string;
  source_id: number;
  target_id: number;
  status: JobStatus;
  total_videos: number;
  processed_videos: number;
  last_processed_id: number | null;
  created_at?: string;
}

export interface ProgressEventPayload {
  job_id: string;
  status: JobStatus;
  message?: string;
  total_videos?: number;
  processed_videos?: number;
  percentage?: number;
  wait_seconds?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "success" | "error";
  text: string;
}
