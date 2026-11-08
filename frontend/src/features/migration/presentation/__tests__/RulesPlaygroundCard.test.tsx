import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RulesPlaygroundCard } from "../components/RulesPlaygroundCard";
import { rulesPlaygroundApi } from "../../infrastructure/rulesPlaygroundApi";
import { useMigrationStore } from "../../application/useMigrationStore";

vi.mock("../../infrastructure/rulesPlaygroundApi", () => ({
  rulesPlaygroundApi: {
    simulateRules: vi.fn(),
  },
}));

describe("RulesPlaygroundCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMigrationStore.setState({
      captionRules: {
        strip_links: true,
        strip_all_mentions: false,
        replace_mentions: { "@canal_antiguo": "@canal_nuevo" },
        remove_words: ["promos"],
        prepend_header: "🔥 ESTRENO",
        append_signature: "👉 Únete",
      },
    });
  });

  it("renders playground inputs and default controls", async () => {
    (rulesPlaygroundApi.simulateRules as any).mockResolvedValueOnce({
      success: true,
      caption: {
        original_caption: "Texto de prueba",
        transformed_caption: "🔥 ESTRENO\n\nTexto de prueba\n\n👉 Únete",
        original_length: 15,
        transformed_length: 35,
        delta_length: 20,
        urls_detected: 0,
        mentions_detected: 0,
        words_removed_count: 0,
      },
      delogo: {
        preset: "top_right",
        x: 1329,
        y: 15,
        w: 576,
        h: 108,
        x_pct: 0.69,
        y_pct: 0.01,
        w_pct: 0.3,
        h_pct: 0.1,
      },
      watermark: {
        text: "@MiCanalOficial",
        position: "bottom_right",
        font_size: 37,
        font_color: "white@0.85",
        with_box: true,
        margin: 25,
        preview_x_pct: 0.82,
        preview_y_pct: 0.9,
      },
      video_dimensions: { width: 1920, height: 1080, aspect_ratio: "1920:1080" },
      filter_type: "delogo_and_watermark",
      ffmpeg_args: ["-vf", "delogo=..."],
      ffmpeg_filter_string: "delogo=x=1329:y=15:w=576:h=108:show=0,drawtext=...",
    });

    render(<RulesPlaygroundCard />);

    expect(screen.getByText("Parámetros de Simulación")).toBeInTheDocument();
    expect(screen.getByText("16:9")).toBeInTheDocument();
    expect(screen.getByText("9:16")).toBeInTheDocument();
    expect(screen.getByText("1:1")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("simulated-watermark")).toHaveTextContent("@MiCanalOficial");
      expect(screen.getByTestId("simulated-delogo")).toBeInTheDocument();
      expect(screen.getByTestId("transformed-caption-output")).toHaveTextContent("🔥 ESTRENO");
    });
  });

  it("updates aspect ratio to 9:16 vertical on click", async () => {
    (rulesPlaygroundApi.simulateRules as any).mockResolvedValue({
      success: true,
      caption: {
        original_caption: "Texto",
        transformed_caption: "Texto",
        original_length: 5,
        transformed_length: 5,
        delta_length: 0,
        urls_detected: 0,
        mentions_detected: 0,
        words_removed_count: 0,
      },
      delogo: {
        preset: "center",
        x: 367,
        y: 844,
        w: 345,
        h: 230,
        x_pct: 0.34,
        y_pct: 0.44,
        w_pct: 0.32,
        h_pct: 0.12,
      },
      watermark: {
        text: "@VerticalVIP",
        position: "center",
        font_size: 40,
        font_color: "white@0.85",
        with_box: true,
        margin: 25,
        preview_x_pct: 0.45,
        preview_y_pct: 0.48,
      },
      video_dimensions: { width: 1080, height: 1920, aspect_ratio: "1080:1920" },
      filter_type: "delogo",
      ffmpeg_args: ["-vf", "delogo=..."],
      ffmpeg_filter_string: "delogo=...",
    });

    render(<RulesPlaygroundCard />);

    const verticalBtn = screen.getByText("9:16");
    fireEvent.click(verticalBtn);

    await waitFor(() => {
      expect(rulesPlaygroundApi.simulateRules).toHaveBeenCalledWith(
        expect.objectContaining({
          video_width: 1080,
          video_height: 1920,
        })
      );
    });
  });
});
