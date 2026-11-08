import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TemplateManagerModal } from "../components/TemplateManagerModal";
import { templatesApi, CaptionTemplate } from "../../infrastructure/templatesApi";

vi.mock("../../infrastructure/templatesApi", () => ({
  templatesApi: {
    listTemplates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    renderTemplate: vi.fn(),
  },
}));

const mockTemplates: CaptionTemplate[] = [
  {
    id: "tpl_estreno",
    tenant_id: "00000000-0000-0000-0000-000000000001",
    name: "Estreno Oficial VIP",
    category: "MIGRATION",
    header: "🎬 ESTRENO EXCLUSIVO",
    body_template: "Película: {title}\nCanal: {channel}\nAño: {year}",
    signature: "👉 Sumate a {channel}",
    caption_rules: {
      strip_links: true,
      strip_all_mentions: false,
      remove_words: [],
    },
    is_default: true,
    created_at: "2026-11-08T00:00:00Z",
    updated_at: "2026-11-08T00:00:00Z",
  },
  {
    id: "tpl_broadcast",
    tenant_id: "00000000-0000-0000-0000-000000000001",
    name: "Aviso de Mantenimiento",
    category: "BROADCAST",
    header: "⚠️ AVISO",
    body_template: "Estimados usuarios, mantenimiento programado.",
    signature: "El equipo técnico",
    caption_rules: null,
    is_default: false,
    created_at: "2026-11-08T00:00:00Z",
    updated_at: "2026-11-08T00:00:00Z",
  },
];

describe("TemplateManagerModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (templatesApi.listTemplates as any).mockResolvedValue(mockTemplates);
  });

  it("renders modal with templates list and preview of default template", async () => {
    render(<TemplateManagerModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText("Estreno Oficial VIP").length).toBeGreaterThan(0);
      expect(screen.getByText("Aviso de Mantenimiento")).toBeInTheDocument();
    });

    expect(screen.getAllByText("🎬 ESTRENO EXCLUSIVO").length).toBeGreaterThan(0);
    expect(screen.getByText(/Guardianes de la Galaxia/i)).toBeInTheDocument();
  });

  it("allows selecting a template and triggers onSelectTemplate callback", async () => {
    const onSelectMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <TemplateManagerModal
        isOpen={true}
        onClose={onCloseMock}
        onSelectTemplate={onSelectMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Usar Esta Plantilla")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Usar Esta Plantilla"));

    expect(onSelectMock).toHaveBeenCalledWith(mockTemplates[0]);
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("switches to editor mode and inserts token when clicked", async () => {
    render(<TemplateManagerModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Nueva Plantilla")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Nueva Plantilla"));

    expect(screen.getByText("Configurar Plantilla")).toBeInTheDocument();
    expect(screen.getByText("{title}")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Escribí el texto base/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("{title}");

    fireEvent.click(screen.getByText("{quality}"));
    expect(textarea.value).toContain("{quality}");
  });

  it("deletes a template when trash button is clicked", async () => {
    (templatesApi.deleteTemplate as any).mockResolvedValue({ success: true });

    render(<TemplateManagerModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText("Estreno Oficial VIP").length).toBeGreaterThan(0);
    });

    const trashButtons = document.querySelectorAll("button svg.lucide-trash-2");
    expect(trashButtons.length).toBeGreaterThan(0);

    const buttonWithTrash = trashButtons[0].closest("button");
    if (buttonWithTrash) {
      fireEvent.click(buttonWithTrash);
      await waitFor(() => {
        expect(templatesApi.deleteTemplate).toHaveBeenCalledWith("tpl_estreno");
      });
    }
  });
});
