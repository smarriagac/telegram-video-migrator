import { AuthResponse, TelegramAccountInfo, User } from "../domain/types";

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al iniciar sesión.");
    }
    return res.json();
  },

  async getMe(token: string): Promise<User> {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error("Sesión inválida o expirada.");
    }
    return res.json();
  },

  async saveTelegramCredentials(
    token: string,
    payload: {
      name: string;
      phone?: string;
      api_id: string;
      api_hash: string;
      session_string?: string;
    }
  ): Promise<TelegramAccountInfo> {
    const res = await fetch("/api/settings/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al guardar las credenciales.");
    }
    return res.json();
  },

  async listTelegramAccounts(token: string): Promise<TelegramAccountInfo[]> {
    const res = await fetch("/api/settings/credentials", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return [];
    }
    return res.json();
  },
};
