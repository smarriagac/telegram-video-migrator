export interface CaptionRules {
  strip_links?: boolean;
  strip_tags?: boolean;
  header_text?: string;
  footer_text?: string;
  replacements?: Array<{ search: string; replace: string }>;
}

export interface MediaFilterRules {
  allow_video?: boolean;
  allow_photo?: boolean;
  allow_document?: boolean;
  min_duration_seconds?: number;
  max_duration_seconds?: number;
}

export interface SyncBinding {
  source_channel_id: number;
  target_channel_id: number;
  source_channel_title?: string;
  target_channel_title?: string;
  source_account_id?: number;
  target_account_id?: number;
  is_active: boolean;
  last_synced_message_id: number;
  created_at?: string;
  updated_at?: string;
  caption_rules?: CaptionRules;
  media_filter_rules?: MediaFilterRules;
}

export interface LiveSyncHealth {
  is_running: boolean;
  active_sources_count: number;
  active_bindings_count: number;
  attached_clients_count: number;
  queue_depth: number;
}

export interface CreateSyncBindingPayload {
  source_channel_id: number;
  target_channel_id: number;
  is_active?: boolean;
  source_channel_title?: string;
  target_channel_title?: string;
  source_account_id?: number;
  target_account_id?: number;
  caption_rules?: CaptionRules;
  media_filter_rules?: MediaFilterRules;
}

export interface UpdateSyncBindingPayload {
  is_active?: boolean;
  source_channel_title?: string;
  target_channel_title?: string;
  caption_rules?: CaptionRules;
  media_filter_rules?: MediaFilterRules;
}
