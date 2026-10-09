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
  media_type?: "video" | "photo" | "document";
}

export interface Chat {
  id: number;
  title: string;
  type: "user" | "group" | "channel";
  unread_count: number;
  last_message?: string;
  last_message_date?: string;
  avatar_color?: string;
}
