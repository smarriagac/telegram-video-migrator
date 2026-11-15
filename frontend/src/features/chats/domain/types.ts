export interface User {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  phone?: string;
  is_bot?: boolean;
}

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  sender_name: string;
  text: string;
  date: string;
  is_outgoing: boolean;
  media_type?: "video" | "photo" | "document" | "text";
  is_read?: boolean;
  buttons?: Array<Array<{ text: string; url?: string | null; has_callback?: boolean; row?: number; col?: number }>> | null;
}

export interface Chat {
  id: number;
  title: string;
  type: "user" | "group" | "channel";
  unread_count: number;
  last_message?: string;
  last_message_date?: string;
  avatar_color?: string;
  can_post?: boolean;
  read_inbox_max_id?: number;
  read_outbox_max_id?: number;
  username?: string;
  account_id?: number;
  participants_count?: number | null;
  online_count?: number | null;
  is_creator?: boolean;
  is_admin?: boolean;
  is_online?: boolean | null;
  status_text?: string | null;
}

export interface ChatFullInfo {
  id: number;
  title: string;
  username?: string | null;
  type: "user" | "group" | "channel";
  participants_count?: number | null;
  online_count?: number | null;
  admins_count?: number | null;
  about?: string | null;
  invite_link?: string | null;
  pinned_message_id?: number | null;
  is_creator?: boolean;
  is_admin?: boolean;
  can_change_info?: boolean;
  phone?: string | null;
  is_bot?: boolean;
  avatar_color?: string | null;
}

export interface ResolvedMessageLink {
  success: boolean;
  chat_id: number;
  chat_title: string;
  chat_username?: string | null;
  message_id: number;
  message: Message;
  error?: string;
}

export interface ChatHashtagInfo {
  tag: string;
  count: number;
  sample_message_ids: number[];
}

export interface ChatHashtagReport {
  success: boolean;
  chat_id: number;
  limit: number;
  scanned_messages: number;
  total_hashtags: number;
  hashtags: ChatHashtagInfo[];
  suggested_message: string;
  error?: string;
}
