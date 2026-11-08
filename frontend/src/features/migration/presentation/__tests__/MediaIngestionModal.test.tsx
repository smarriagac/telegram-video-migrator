import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MediaIngestionModal } from "../components/MediaIngestionModal";
import { mediaIngestionApi } from "../../infrastructure/mediaIngestionApi";
import { Channel } from "@/features/migration/domain/types";

vi.mock("../../infrastructure/mediaIngestionApi", () => ({
  mediaIngestionApi: {
    inspectUrl: vi.fn(),
    stage: vi.fn(),
    getAspectRatioPresets: vi.fn().mockResolvedValue([
      { id: "ORIGINAL", label: "Original", description: "Sin alterar" },
      { id: "9:16_BLUR", label: "Stories (Blur)", description: "Lienzo 9:16 con fondo borroso" },
      { id: "9:16_CROP", label: "Stories (Crop)", description: "Recorte 9:16 centrado" },
    ]),
  },
}));

const mockChannels: Channel[] = [
  {
    id: 1001,
    title: "Canal Principal",
    username: "canalprincipal",
    can_post: true,
  },
  {
    id: 1002,
    title: "Canal Secundario",
    username: "canalsecundario",
    can_post: true,
  },
];

describe("MediaIngestionModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal header, URL input and aspect ratio selectors", () => {
    render(
      <MediaIngestionModal
        isOpen={true}
        onClose={vi.fn()}
        channels={mockChannels}
        selectedTargetId={1001}
      />
    );

    expect(screen.getByText(/Ingestor Multiplataforma & Telegram Stories 9:16/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/tiktok\.com/i)).toBeInTheDocument();
    expect(screen.getByText("Stories (Blur)")).toBeInTheDocument();
    expect(screen.getByText("Stories (Crop)")).toBeInTheDocument();
  });

  it("handles video inspect call successfully and displays metadata", async () => {
    (mediaIngestionApi.inspectUrl as any).mockResolvedValueOnce({
      success: true,
      platform: "tiktok",
      title: "Epic Dance Routine",
      uploader: "@dancer_pro",
      duration: 15.2,
      thumbnail: "https://example.com/thumb.jpg",
      webpage_url: "https://tiktok.com/@dancer_pro/video/1",
    });

    render(
      <MediaIngestionModal
        isOpen={true}
        onClose={vi.fn()}
        channels={mockChannels}
        selectedTargetId={1001}
      />
    );

    const input = screen.getByPlaceholderText(/tiktok\.com/i);
    fireEvent.change(input, { target: { value: "https://tiktok.com/@dancer_pro/video/1" } });

    const inspectBtn = screen.getByRole("button", { name: /Inspeccionar/i });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(mediaIngestionApi.inspectUrl).toHaveBeenCalledWith("https://tiktok.com/@dancer_pro/video/1");
      expect(screen.getAllByText("Epic Dance Routine").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("@dancer_pro")).toBeInTheDocument();
    });
  });
});
