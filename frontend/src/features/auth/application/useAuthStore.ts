import { create } from "zustand";
import { TelegramAccountInfo, User } from "../domain/types";
import { authApi } from "../infrastructure/authApi";

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  accounts: TelegramAccountInfo[];

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  saveCredentials: (payload: {
    name: string;
    phone?: string;
    api_id: string;
    api_hash: string;
    session_string?: string;
  }) => Promise<boolean>;
}

const TOKEN_KEY = "telegram_hub_token";
const savedToken = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: savedToken,
  user: null,
  isAuthenticated: !!savedToken,
  isLoading: false,
  error: null,
  accounts: [],

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login(email, password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      set({
        token: res.access_token,
        user: res.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message || "Credenciales incorrectas", isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      error: null,
      accounts: [],
    });
  },

  checkAuth: async () => {
    const { token } = get();
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      const user = await authApi.getMe(token);
      set({ user, isAuthenticated: true });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, user: null, isAuthenticated: false });
    }
  },

  loadAccounts: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const accounts = await authApi.listTelegramAccounts(token);
      set({ accounts });
    } catch (err) {
      console.error("Error cargando cuentas de Telegram:", err);
    }
  },

  saveCredentials: async (payload) => {
    const { token } = get();
    if (!token) return false;
    set({ isLoading: true, error: null });
    try {
      const saved = await authApi.saveTelegramCredentials(token, payload);
      set((state) => ({
        accounts: [saved, ...state.accounts.filter((a) => a.id !== saved.id)],
        isLoading: false,
      }));
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },
}));
