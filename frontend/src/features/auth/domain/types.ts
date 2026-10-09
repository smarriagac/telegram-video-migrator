export type Role = "ADMIN" | "OPERATOR" | "VIEWER";

export interface User {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TelegramAccountInfo {
  id: number;
  name: string;
  phone?: string | null;
  api_id_masked: string;
  api_hash_masked: string;
  has_session: boolean;
  is_active: boolean;
  created_at?: string | null;
}
