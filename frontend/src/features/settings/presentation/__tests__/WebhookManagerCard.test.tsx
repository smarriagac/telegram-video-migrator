import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { WebhookManagerCard } from "../components/WebhookManagerCard";
import {
  webhooksApi,
  WebhookEndpoint,
  WebhookDelivery,
  WebhookDeliveriesSummary,
} from "../../infrastructure/webhooksApi";

vi.mock("../../infrastructure/webhooksApi", () => ({
  webhooksApi: {
    listWebhooks: vi.fn(),
    createWebhook: vi.fn(),
    updateWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
    testWebhook: vi.fn(),
    fetchDeliveriesSummary: vi.fn(),
    listDeliveries: vi.fn(),
    listDLQDeliveries: vi.fn(),
    retryDelivery: vi.fn(),
    retryAllDLQ: vi.fn(),
    dismissDelivery: vi.fn(),
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

const mockDeliveries: WebhookDelivery[] = [
  {
    id: "deliv_101",
    webhook_id: "whk_discord_1",
    tenant_id: "00000000-0000-0000-0000-000000000001",
    event_type: "job.failed",
    url: "https://discord.com/api/webhooks/123/abc",
    payload: { job_id: "job-failed-99" },
    status: "DLQ",
    attempts: 5,
    max_attempts: 5,
    last_status_code: 504,
    last_error: "Gateway Timeout after 10.0s",
    created_at: "2026-11-08T01:00:00Z",
    updated_at: "2026-11-08T01:10:00Z",
  },
  {
    id: "deliv_102",
    webhook_id: "whk_slack_2",
    tenant_id: "00000000-0000-0000-0000-000000000001",
    event_type: "flood_wait",
    url: "https://hooks.slack.com/services/T00/B00/xyz",
    payload: { seconds: 120 },
    status: "PENDING",
    attempts: 1,
    max_attempts: 5,
    last_status_code: 502,
    last_error: "Bad Gateway",
    next_retry_at: "2026-11-08T02:00:00Z",
    created_at: "2026-11-08T01:05:00Z",
    updated_at: "2026-11-08T01:05:00Z",
  },
];

const mockSummary: WebhookDeliveriesSummary = {
  total: 5,
  dlq: 1,
  pending: 1,
  delivered: 3,
  failed: 0,
};

describe("WebhookManagerCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (webhooksApi.listWebhooks as any).mockResolvedValue(mockWebhooks);
    (webhooksApi.fetchDeliveriesSummary as any).mockResolvedValue(mockSummary);
    (webhooksApi.listDeliveries as any).mockResolvedValue({
      items: mockDeliveries,
      total: 2,
      limit: 50,
      offset: 0,
    });
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

  it("switches to Dead-Letter Queue tab and renders delivery audit items", async () => {
    render(<WebhookManagerCard />);

    await waitFor(() => {
      expect(screen.getByText("Dead-Letter Queue")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Dead-Letter Queue"));

    await waitFor(() => {
      expect(screen.getByText("job.failed")).toBeInTheDocument();
      expect(screen.getByText("DLQ Caído")).toBeInTheDocument();
      expect(screen.getByText("Reintentando")).toBeInTheDocument();
      expect(screen.getByText(/Intentos: 5\/5/i)).toBeInTheDocument();
    });
  });

  it("triggers individual delivery retry on DLQ item", async () => {
    (webhooksApi.retryDelivery as any).mockResolvedValue({
      success: true,
      status_code: 200,
    });

    render(<WebhookManagerCard />);

    fireEvent.click(screen.getByText("Dead-Letter Queue"));

    await waitFor(() => {
      expect(screen.getByText("job.failed")).toBeInTheDocument();
    });

    const retryBtns = screen.getAllByRole("button", { name: /^reintentar$/i });
    expect(retryBtns.length).toBeGreaterThan(0);

    fireEvent.click(retryBtns[0]);

    await waitFor(() => {
      expect(webhooksApi.retryDelivery).toHaveBeenCalledWith("deliv_101");
      expect(screen.getByText(/Entrega reintentada con éxito/i)).toBeInTheDocument();
    });
  });

  it("triggers 1-Click batch redelivery for all DLQ items", async () => {
    (webhooksApi.retryAllDLQ as any).mockResolvedValue({
      total_retried: 1,
      succeeded: 1,
      failed: 0,
    });

    render(<WebhookManagerCard />);

    fireEvent.click(screen.getByText("Dead-Letter Queue"));

    await waitFor(() => {
      expect(screen.getByText(/Reintentar Todo DLQ \(1\)/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Reintentar Todo DLQ \(1\)/i));

    await waitFor(() => {
      expect(webhooksApi.retryAllDLQ).toHaveBeenCalled();
      expect(screen.getByText(/Reintento masivo completado: 1 exitosos/i)).toBeInTheDocument();
    });
  });
});
