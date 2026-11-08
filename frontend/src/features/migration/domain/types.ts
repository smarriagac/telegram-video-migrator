export type JobStatus =
  | "PENDING"
  | "SCHEDULED"
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
  type?: "channel" | "group" | "supergroup" | string;
}

export interface CaptionRules {
  strip_links?: boolean;
  strip_all_mentions?: boolean;
  replace_mentions?: Record<string, string>;
  remove_words?: string[];
  prepend_header?: string | null;
  append_signature?: string | null;
  ai_enabled?: boolean;
  ai_target_lang?: string | null;
  ai_tone?: "NEUTRAL" | "ENGAGING" | "PROFESSIONAL" | "CONCISE" | "VIRAL" | null;
  ai_auto_hashtags?: boolean;
  ai_clean_spam?: boolean;
  ai_summarize?: boolean;
}

export interface MediaFilterRules {
  min_duration_seconds?: number | null;
  max_duration_seconds?: number | null;
  min_height?: number | null;
  min_width?: number | null;
  min_file_size_bytes?: number | null;
  max_file_size_bytes?: number | null;
  allowed_media_types?: string[];
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
  scheduled_at?: string | null;
  source_account_id?: number;
  target_account_id?: number;
  caption_rules?: CaptionRules | null;
  drip_delay_seconds?: number;
  media_filter_rules?: MediaFilterRules | null;
  failover_count?: number;
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
    deduplicated?: number;
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
  is_deduplicated?: boolean;
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
    deduplicated?: number;
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

export interface AutoSyncBinding {
  source_channel_id: number;
  target_channel_id: number;
  source_channel_title: string | null;
  target_channel_title: string | null;
  source_account_id?: number;
  target_account_id?: number;
  is_active: boolean;
  last_synced_message_id: number;
  created_at?: string;
  updated_at?: string;
  caption_rules?: CaptionRules | null;
  media_filter_rules?: MediaFilterRules | null;
}

export interface AutoSyncStatus {
  is_active: boolean;
  binding: AutoSyncBinding | null;
}


