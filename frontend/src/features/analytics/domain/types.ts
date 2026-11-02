export interface DailyVolumePoint {
  date: string;
  count: number;
  estimated_mb: number;
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
}
