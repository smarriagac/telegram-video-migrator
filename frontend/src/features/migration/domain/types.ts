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
  account_id?: number;
  account_name?: string;
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
  source_account_id?: number;
  target_account_id?: number;
}

export interface ProgressEventPayload {
  job_id: string;
  status: JobStatus;
  message?: string;
  total_videos?: number;
  processed_videos?: number;
  percentage?: number;
  wait_seconds?: number;
  queue_stats?: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    failed: number;
    skipped: number;
  };
}

export interface ChannelMessageItem {
  id: number;
  channel_id: number;
  text: string;
  media_type: "video" | "photo" | "document" | "text" | null;
  date: string;
  file_size: number | null;
  views: number | null;
  is_migrated: boolean;
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
  created_at?: string;
  updated_at?: string;
}

export interface JobQueueStatus {
  job_id: string;
  stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    failed: number;
    skipped: number;
  };
  items: QueueItem[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "success" | "error";
  text: string;
}

export interface JobHistoryItem {
  job_id: string;
  source_id: number;
  source_title: string | null;
  target_id: number;
  target_title: string | null;
  status: JobStatus;
  total_videos: number;
  processed_videos: number;
  is_full_migration: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ChannelCloningHistory {
  channel_id: number;
  total_clones: number;
  has_full_clone: boolean;
  total_items_cloned: number;
  jobs: JobHistoryItem[];
}

export interface ClonedContentItem {
  job_id: string;
  source_message_id: number;
  target_message_id: number | null;
  media_type: string;
  caption: string;
  migrated_at: string | null;
  target_channel_id: number;
  target_channel_title: string | null;
}

export interface ChannelSyncStatus {
  source_channel_id: number;
  target_channel_id: number;
  total_source_messages: number;
  already_cloned_count: number;
  missing_count: number;
  is_in_sync: boolean;
  missing_messages: ChannelMessageItem[];
}

