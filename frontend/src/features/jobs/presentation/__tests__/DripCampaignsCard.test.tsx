import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DripCampaignsCard } from "../components/DripCampaignsCard";
import { dripApi, DripCampaign } from "../../infrastructure/dripApi";

vi.mock("../../infrastructure/dripApi", () => ({
  dripApi: {
    fetchCampaigns: vi.fn(),
    fetchCampaignItems: vi.fn(),
    pauseCampaign: vi.fn(),
    resumeCampaign: vi.fn(),
    deleteCampaign: vi.fn(),
    releaseItemNow: vi.fn(),
    updateItemCaption: vi.fn(),
    skipItem: vi.fn(),
    createCampaign: vi.fn(),
  },
}));

const mockCampaigns: DripCampaign[] = [
  {
    id: "camp_test_1",
    title: "Campaña Noticias Nocturnas",
    source_channel_id: -100111,
    target_channel_id: -100222,
    status: "ACTIVE",
    interval_minutes: 120,
    batch_size: 1,
    jitter_seconds: 30,
    daily_window_start: "09:00",
    daily_window_end: "22:00",
    total_items: 10,
    released_items: 4,
    failed_items: 0,
    next_release_at: "2026-11-08T20:00:00Z",
    created_at: "2026-11-08T10:00:00Z",
    updated_at: "2026-11-08T10:00:00Z",
  },
];

describe("DripCampaignsCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders explanation banner, KPI cards, and fetched campaigns", async () => {
    vi.mocked(dripApi.fetchCampaigns).mockResolvedValueOnce(mockCampaigns);

    render(<DripCampaignsCard />);

    expect(screen.getByText(/Content Reservoir & Campañas de Goteo Programado/i)).toBeInTheDocument();
    expect(screen.getByText(/Campañas Totales/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Campaña Noticias Nocturnas")).toBeInTheDocument();
      expect(screen.getByText(/120m/i)).toBeInTheDocument();
      expect(screen.getByText(/4\/10/i)).toBeInTheDocument();
    });
  });

  it("opens create campaign modal on button click", async () => {
    vi.mocked(dripApi.fetchCampaigns).mockResolvedValueOnce([]);

    render(<DripCampaignsCard />);

    const newBtn = screen.getByRole("button", { name: /Nueva Campaña Drip/i });
    fireEvent.click(newBtn);

    expect(screen.getByPlaceholderText(/ej\. Lanzamiento escalonado Noviembre/i)).toBeInTheDocument();
    expect(screen.getByText(/IDs de Mensajes a Encolar/i)).toBeInTheDocument();
  });
});
