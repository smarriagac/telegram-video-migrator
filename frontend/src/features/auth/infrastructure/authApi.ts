import { AuthResponse, Role, TelegramAccountInfo, User } from "../domain/types";

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

  async listUsers(token: string): Promise<User[]> {
    const res = await fetch("/api/auth/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return [];
    }
    return res.json();
  },

  async createUser(
    token: string,
    payload: { email: string; password: string; role: Role }
  ): Promise<User> {
    const res = await fetch("/api/auth/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al registrar el usuario.");
    }
    return res.json();
  },

  async updateUser(
    token: string,
    userId: number,
    payload: { role?: Role; is_active?: boolean }
  ): Promise<User> {
    const res = await fetch(`/api/auth/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al actualizar el usuario.");
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
