export interface DailyVolumePoint {
  date: string;
  count: number;
  estimated_mb: number;
}

export interface RecentTransferItem {
  job_id: string;
  source_channel_id: number;
  target_channel_id: number;
  source_title: string;
  target_title: string;
  status: string;
  total_videos: number;
  processed_videos: number;
  estimated_mb: number;
  created_at: string;
}

export interface TopChannelTrafficItem {
  channel_id: number;
  title: string;
  total_items: number;
  volume_gb: number;
}

export interface PipelineHealthMetrics {
  local_io_bypass_percent: number;
  avg_speed_sec_per_item: number;
  push_daemon_status: string;
}

export interface AnalyticsOverview {
  total_items_migrated: number;
  total_bandwidth_saved_bytes: number;
  total_bandwidth_saved_gb: number;
  duplicates_prevented: number;
  total_jobs: number;
  jobs_by_status: Record<string, number>;
  active_sync_bindings: number;
  media_type_distribution: Record<string, number>;
  daily_volume: DailyVolumePoint[];
  efficiency_percent: number;
  recent_transfers?: RecentTransferItem[];
  top_channels?: TopChannelTrafficItem[];
  pipeline_health?: PipelineHealthMetrics;
}
