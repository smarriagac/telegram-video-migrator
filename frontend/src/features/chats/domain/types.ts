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
