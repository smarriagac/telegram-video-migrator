import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { HashtagDirectoryModal } from "../components/HashtagDirectoryModal";
import { chatApi } from "../../infrastructure/chatApi";

vi.mock("../../infrastructure/chatApi", () => ({
  chatApi: {
    fetchChatHashtags: vi.fn(),
  },
}));

describe("HashtagDirectoryModal Component", () => {
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  const mockLoadDraft = vi.fn();
  const mockSelectHashtag = vi.fn();
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders discovered hashtags and generates directory message", async () => {
    (chatApi.fetchChatHashtags as any).mockResolvedValueOnce({
      success: true,
      chat_id: 12345,
      limit: 200,
      scanned_messages: 50,
      total_hashtags: 2,
      hashtags: [
        { tag: "#Netflix", count: 12, sample_message_ids: [1, 2] },
        { tag: "#Peliculas", count: 8, sample_message_ids: [3, 4] },
      ],
      suggested_message: "📌 **ÍNDICE DE ETIQUETAS Y CONTENIDO**\nCanal: **Canal Test**\n\n🔹 #Netflix — (12 publicaciones)\n🔹 #Peliculas — (8 publicaciones)",
    });

    render(
      <HashtagDirectoryModal
        isOpen={true}
        onClose={mockClose}
        chatId={12345}
        chatTitle="Canal Test"
        onPublish={mockPublish}
        onLoadDraft={mockLoadDraft}
        onSelectHashtag={mockSelectHashtag}
      />
    );

    expect(screen.getByText(/Generador de Índice por Hashtags/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("#Netflix")).toBeInTheDocument();
      expect(screen.getByText("#Peliculas")).toBeInTheDocument();
    });

    expect(chatApi.fetchChatHashtags).toHaveBeenCalledWith(12345, 0, undefined);
  });

  it("handles publish action when clicking 'Publicar en Canal'", async () => {
    (chatApi.fetchChatHashtags as any).mockResolvedValueOnce({
      success: true,
      chat_id: 12345,
      limit: 200,
      scanned_messages: 20,
      total_hashtags: 1,
      hashtags: [{ tag: "#Oferta", count: 5, sample_message_ids: [10] }],
    });

    render(
      <HashtagDirectoryModal
        isOpen={true}
        onClose={mockClose}
        chatId={12345}
        chatTitle="Canal Test"
        onPublish={mockPublish}
        onLoadDraft={mockLoadDraft}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("#Oferta")).toBeInTheDocument();
    });

    const publishBtn = screen.getByRole("button", { name: /Publicar en Canal/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(mockPublish).toHaveBeenCalled();
      const calledText = mockPublish.mock.calls[0][0];
      expect(calledText).toContain("#Oferta");
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it("handles loading directory into draft", async () => {
    (chatApi.fetchChatHashtags as any).mockResolvedValueOnce({
      success: true,
      chat_id: 12345,
      limit: 200,
      scanned_messages: 20,
      total_hashtags: 1,
      hashtags: [{ tag: "#Directorio", count: 2, sample_message_ids: [1] }],
    });

    render(
      <HashtagDirectoryModal
        isOpen={true}
        onClose={mockClose}
        chatId={12345}
        chatTitle="Canal Test"
        onPublish={mockPublish}
        onLoadDraft={mockLoadDraft}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("#Directorio")).toBeInTheDocument();
    });

    const draftBtn = screen.getByRole("button", { name: /Cargar en Borrador/i });
    fireEvent.click(draftBtn);

    expect(mockLoadDraft).toHaveBeenCalled();
    const loadedText = mockLoadDraft.mock.calls[0][0];
    expect(loadedText).toContain("#Directorio");
    expect(mockClose).toHaveBeenCalled();
  });

  it("switches directory layout to Alphabetical A-Z and Compact Cloud", async () => {
    (chatApi.fetchChatHashtags as any).mockResolvedValueOnce({
      success: true,
      chat_id: 12345,
      limit: 200,
      scanned_messages: 50,
      total_hashtags: 2,
      hashtags: [
        { tag: "#Netflix", count: 12, sample_message_ids: [1] },
        { tag: "#Amazon", count: 8, sample_message_ids: [2] },
      ],
      suggested_message: "📌 Índice",
    });

    render(
      <HashtagDirectoryModal
        isOpen={true}
        onClose={mockClose}
        chatId={12345}
        chatTitle="Canal Test"
        onPublish={mockPublish}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("#Netflix")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/El índice generado aparecerá aquí/i) as HTMLTextAreaElement;

    // Switch to Alphabetical A-Z
    const azBtn = screen.getByRole("button", { name: /A-Z/i });
    fireEvent.click(azBtn);

    expect(textarea.value).toContain("📁 **A**");
    expect(textarea.value).toContain("▫️ #Amazon");
    expect(textarea.value).toContain("📁 **N**");
    expect(textarea.value).toContain("▫️ #Netflix");

    // Switch to Compact Cloud
    const compactBtn = screen.getByRole("button", { name: /Nube Compacta/i });
    fireEvent.click(compactBtn);

    expect(textarea.value).toContain("#Netflix (12)  •  #Amazon (8)");
  });
});
