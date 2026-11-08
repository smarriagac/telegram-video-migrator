import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { WebhookManagerCard } from "../components/WebhookManagerCard";
import { webhooksApi, WebhookEndpoint } from "../../infrastructure/webhooksApi";

vi.mock("../../infrastructure/webhooksApi", () => ({
  webhooksApi: {
    listWebhooks: vi.fn(),
    createWebhook: vi.fn(),
    updateWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
    testWebhook: vi.fn(),
  },
}));

const mockWebhooks: WebhookEndpoint[] = [
  {
    id: "whk_discord_1",
    tenant_id: "00000000-0000-0000-0000-000000000001",
    name: "Canal Discord Incidentes",
    target_type: "DISCORD",
    url: "https://discord.com/api/webhooks/123/abc",
    secret_token: null,
    events: ["flood_wait", "job.failed"],
    is_enabled: true,
    last_status_code: 204,
    last_error: null,
    last_dispatched_at: "2026-11-08T00:00:00Z",
    created_at: "2026-11-08T00:00:00Z",
    updated_at: "2026-11-08T00:00:00Z",
  },
  {
    id: "whk_slack_2",
    tenant_id: "00000000-0000-0000-0000-000000000001",
    name: "Slack Ops Room",
    target_type: "SLACK",
    url: "https://hooks.slack.com/services/T00/B00/xyz",
    secret_token: null,
    events: ["backup.created"],
    is_enabled: false,
    last_status_code: null,
    last_error: null,
    last_dispatched_at: null,
    created_at: "2026-11-08T00:00:00Z",
    updated_at: "2026-11-08T00:00:00Z",
  },
];

describe("WebhookManagerCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (webhooksApi.listWebhooks as any).mockResolvedValue(mockWebhooks);
  });

  it("renders webhooks list with targets and status", async () => {
    render(<WebhookManagerCard />);

    await waitFor(() => {
      expect(screen.getByText("Canal Discord Incidentes")).toBeInTheDocument();
      expect(screen.getByText("Slack Ops Room")).toBeInTheDocument();
    });

    expect(screen.getByText("Discord")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("HTTP 204")).toBeInTheDocument();
  });

  it("opens new webhook form, fills fields and calls createWebhook", async () => {
    const newWh: WebhookEndpoint = {
      id: "whk_new_3",
      tenant_id: "00000000-0000-0000-0000-000000000001",
      name: "Custom API Endpoint",
      target_type: "GENERIC",
      url: "https://example.com/webhook",
      secret_token: "secret123",
      events: ["flood_wait"],
      is_enabled: true,
      last_status_code: null,
      last_error: null,
      last_dispatched_at: null,
      created_at: "2026-11-08T00:00:00Z",
      updated_at: "2026-11-08T00:00:00Z",
    };
    (webhooksApi.createWebhook as any).mockResolvedValue(newWh);

    render(<WebhookManagerCard />);

    await waitFor(() => {
      expect(screen.getByText("Nuevo Webhook")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Nuevo Webhook"));

    expect(screen.getByText("Configurar Nuevo Destino de Notificación")).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Ej: Canal Discord/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/discord.com/i);

    fireEvent.change(nameInput, { target: { value: "Custom API Endpoint" } });
    fireEvent.change(urlInput, { target: { value: "https://example.com/webhook" } });

    fireEvent.click(screen.getByText("Guardar Webhook"));

    await waitFor(() => {
      expect(webhooksApi.createWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Custom API Endpoint",
          url: "https://example.com/webhook",
        })
      );
    });
  });

  it("triggers test webhook ping and displays outcome", async () => {
    (webhooksApi.testWebhook as any).mockResolvedValue({
      success: true,
      status_code: 200,
      endpoint: { ...mockWebhooks[0], last_status_code: 200 },
    });

    render(<WebhookManagerCard />);

    await waitFor(() => {
      expect(screen.getByText("Canal Discord Incidentes")).toBeInTheDocument();
    });

    const testButtons = screen.getAllByText("Probar");
    expect(testButtons.length).toBeGreaterThan(0);

    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(webhooksApi.testWebhook).toHaveBeenCalledWith("whk_discord_1");
      expect(screen.getByText(/Prueba exitosa \(HTTP 200\)/i)).toBeInTheDocument();
    });
  });

  it("deletes a webhook endpoint when trash icon clicked", async () => {
    (webhooksApi.deleteWebhook as any).mockResolvedValue({ success: true, deleted_id: "whk_discord_1" });

    render(<WebhookManagerCard />);

    await waitFor(() => {
      expect(screen.getByText("Canal Discord Incidentes")).toBeInTheDocument();
    });

    const trashIcons = document.querySelectorAll("button svg.lucide-trash-2");
    expect(trashIcons.length).toBeGreaterThan(0);

    const buttonWithTrash = trashIcons[0].closest("button");
    if (buttonWithTrash) {
      fireEvent.click(buttonWithTrash);
      await waitFor(() => {
        expect(webhooksApi.deleteWebhook).toHaveBeenCalledWith("whk_discord_1");
      });
    }
  });
});
