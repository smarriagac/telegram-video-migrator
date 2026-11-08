import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../useAuthStore";
import { authApi } from "../../infrastructure/authApi";

vi.mock("../../infrastructure/authApi", () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
    listTelegramAccounts: vi.fn(),
    listUsers: vi.fn(),
    saveTelegramCredentials: vi.fn(),
    deleteTelegramAccount: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      accounts: [],
      usersList: [],
    });
    vi.clearAllMocks();
  });

  it("handles successful login and stores token in localStorage", async () => {
    const mockUser = {
      id: 1,
      email: "admin@telegramhub.local",
      role: "ADMIN" as const,
      is_active: true,
    };
    (authApi.login as any).mockResolvedValueOnce({
      access_token: "jwt-test-token-xyz",
      token_type: "bearer",
      user: mockUser,
    });

    const success = await useAuthStore.getState().login("admin@telegramhub.local", "secret123");

    expect(success).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe("jwt-test-token-xyz");
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(localStorage.getItem("telegram_hub_token")).toBe("jwt-test-token-xyz");
  });

  it("handles failed login and sets error message", async () => {
    (authApi.login as any).mockRejectedValueOnce(new Error("Invalid credentials"));

    const success = await useAuthStore.getState().login("wrong@user.com", "wrongpass");

    expect(success).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toBe("Invalid credentials");
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("clears state and removes token on logout", () => {
    localStorage.setItem("telegram_hub_token", "active-token");
    useAuthStore.setState({
      token: "active-token",
      user: {
        id: 1,
        email: "test@hub.local",
        role: "OPERATOR",
        is_active: true,
      },
      isAuthenticated: true,
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem("telegram_hub_token")).toBeNull();
  });

  it("checkAuth restores user when token is valid", async () => {
    const mockUser = {
      id: 2,
      email: "operator@hub.local",
      role: "OPERATOR" as const,
      is_active: true,
    };
    useAuthStore.setState({ token: "valid-token" });
    (authApi.getMe as any).mockResolvedValueOnce(mockUser);

    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
