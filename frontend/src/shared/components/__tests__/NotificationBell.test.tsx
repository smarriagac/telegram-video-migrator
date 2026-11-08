import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotificationBell } from "../NotificationBell";
import { notificationApi } from "@/shared/infrastructure/notificationApi";

vi.mock("@/shared/infrastructure/notificationApi", () => ({
  notificationApi: {
    getUnreadCount: vi.fn(),
    listNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

describe("NotificationBell Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bell button and displays unread count badge", async () => {
    (notificationApi.getUnreadCount as any).mockResolvedValueOnce(3);

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("opens popover with notification items on click", async () => {
    (notificationApi.getUnreadCount as any).mockResolvedValueOnce(1);
    (notificationApi.listNotifications as any).mockResolvedValueOnce([
      {
        id: "notif-1",
        title: "FloodWait Detectado",
        message: "Se pausó cuenta 1 por 45s",
        severity: "WARNING",
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    const trigger = screen.getByRole("button", { name: /notificaciones/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("FloodWait Detectado")).toBeInTheDocument();
      expect(screen.getByText("Se pausó cuenta 1 por 45s")).toBeInTheDocument();
    });
  });

  it("calls markAllAsRead when 'Marcar todas leídas' is clicked", async () => {
    (notificationApi.getUnreadCount as any).mockResolvedValue(2);
    (notificationApi.listNotifications as any).mockResolvedValue([
      {
        id: "notif-1",
        title: "Test Alert",
        message: "Mensaje de prueba",
        severity: "INFO",
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);
    (notificationApi.markAllAsRead as any).mockResolvedValue(2);

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    const trigger = screen.getByRole("button", { name: /notificaciones/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Test Alert")).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole("button", { name: /marcar leídas/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1);
    });
  });
});
