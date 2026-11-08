import React, { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Edit3,
  Check,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  templatesApi,
  CaptionTemplate,
} from "../../infrastructure/templatesApi";
import { cn } from "@/shared/lib/utils";

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: CaptionTemplate) => void;
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Templates collection & selection state
  const [templatesState, setTemplatesState] = useState<{
    templates: CaptionTemplate[];
    selectedId: string | null;
    isLoading: boolean;
  }>({
    templates: [],
    selectedId: null,
    isLoading: true,
  });

  // Hook 2: Editor form, saving status, and preview feedback
  const [editorState, setEditorState] = useState<{
    isEditing: boolean;
    isSaving: boolean;
    name: string;
    category: "MIGRATION" | "BROADCAST" | "WATERMARK" | "GENERAL";
    header: string;
    bodyTemplate: string;
    signature: string;
    feedback: { message: string; isError?: boolean } | null;
  }>({
    isEditing: false,
    isSaving: false,
    name: "",
    category: "GENERAL",
    header: "",
    bodyTemplate: "",
    signature: "",
    feedback: null,
  });

  const loadTemplates = async () => {
    setTemplatesState((prev) => ({ ...prev, isLoading: true }));
    try {
      const list = await templatesApi.listTemplates();
      setTemplatesState((prev) => ({
        ...prev,
        templates: list,
        selectedId: prev.selectedId || (list.length > 0 ? list[0].id : null),
        isLoading: false,
      }));
    } catch (err: any) {
      setTemplatesState((prev) => ({ ...prev, isLoading: false }));
      showFeedback(err.message || "Error al cargar plantillas", true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const showFeedback = (message: string, isError = false) => {
    setEditorState((prev) => ({ ...prev, feedback: { message, isError } }));
    setTimeout(() => {
      setEditorState((prev) => ({ ...prev, feedback: null }));
    }, 3500);
  };

  const handleStartCreate = () => {
    setEditorState({
      isEditing: true,
      isSaving: false,
      name: "",
      category: "GENERAL",
      header: "",
      bodyTemplate: "📹 {title}\nCanal: {channel}\nAño: {year}",
      signature: "👉 Únete: {channel}",
      feedback: null,
    });
  };

  const handleStartEdit = (tpl: CaptionTemplate) => {
    setEditorState({
      isEditing: true,
      isSaving: false,
      name: tpl.name,
      category: tpl.category,
      header: tpl.header || "",
      bodyTemplate: tpl.body_template || "",
      signature: tpl.signature || "",
      feedback: null,
    });
  };

  const handleSave = async () => {
    if (!editorState.name.trim()) {
      showFeedback("El nombre de la plantilla es obligatorio", true);
      return;
    }
    setEditorState((prev) => ({ ...prev, isSaving: true }));

    const payload = {
      name: editorState.name.trim(),
      category: editorState.category,
      header: editorState.header.trim() || null,
      body_template: editorState.bodyTemplate.trim(),
      signature: editorState.signature.trim() || null,
    };

    try {
      if (templatesState.selectedId && editorState.isEditing && editorState.name !== "") {
        // If updating an existing selection
        const existing = templatesState.templates.find((t) => t.id === templatesState.selectedId);
        if (existing && existing.name === editorState.name) {
          const updated = await templatesApi.updateTemplate(existing.id, payload);
          setTemplatesState((prev) => ({
            ...prev,
            templates: prev.templates.map((t) => (t.id === updated.id ? updated : t)),
          }));
          showFeedback("Plantilla actualizada con éxito");
          setEditorState((prev) => ({ ...prev, isEditing: false, isSaving: false }));
          return;
        }
      }

      // Otherwise create new
      const created = await templatesApi.createTemplate(payload);
      setTemplatesState((prev) => ({
        ...prev,
        templates: [created, ...prev.templates],
        selectedId: created.id,
      }));
      showFeedback("Plantilla guardada correctamente");
      setEditorState((prev) => ({ ...prev, isEditing: false, isSaving: false }));
    } catch (err: any) {
      setEditorState((prev) => ({ ...prev, isSaving: false }));
      showFeedback(err.message || "Error al guardar plantilla", true);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      await templatesApi.deleteTemplate(templateId);
      setTemplatesState((prev) => {
        const remaining = prev.templates.filter((t) => t.id !== templateId);
        return {
          ...prev,
          templates: remaining,
          selectedId: remaining.length > 0 ? remaining[0].id : null,
        };
      });
      showFeedback("Plantilla eliminada");
    } catch (err: any) {
      showFeedback(err.message || "Error al eliminar plantilla", true);
    }
  };

  const insertToken = (token: string) => {
    setEditorState((prev) => ({
      ...prev,
      bodyTemplate: `${prev.bodyTemplate} ${token}`,
    }));
  };

  const selectedTemplate = templatesState.templates.find(
    (t) => t.id === templatesState.selectedId
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card border-border">
        <DialogHeader className="p-4 border-b border-border bg-secondary/30 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground font-mono">
                Gestor de Plantillas de Captions y Mensajes
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Textos reutilizables con interpolación dinámica de variables y sanitización.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleStartCreate}
            className="h-8 text-xs flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground mr-6"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Plantilla</span>
          </Button>
        </DialogHeader>

        {/* Feedback Alert */}
        {editorState.feedback && (
          <div
            className={cn(
              "m-3 p-2.5 rounded-md text-xs font-medium flex items-center gap-2",
              editorState.feedback.isError
                ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
            )}
          >
            {editorState.feedback.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{editorState.feedback.message}</span>
          </div>
        )}

        {/* Body Grid: Sidebar list + Detail / Editor */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: List of saved templates (5 cols) */}
          <div className="md:col-span-4 border-r border-border overflow-y-auto p-3 space-y-2 bg-secondary/10">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block px-1">
              Plantillas Disponibles ({templatesState.templates.length})
            </span>

            {templatesState.isLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Cargando...</div>
            ) : templatesState.templates.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No hay plantillas guardadas.
              </div>
            ) : (
              templatesState.templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    setTemplatesState((prev) => ({ ...prev, selectedId: tpl.id }));
                    setEditorState((prev) => ({ ...prev, isEditing: false }));
                  }}
                  className={cn(
                    "p-2.5 rounded-lg border text-xs cursor-pointer transition-all space-y-1 group",
                    templatesState.selectedId === tpl.id && !editorState.isEditing
                      ? "bg-primary/10 border-primary/40 shadow-sm"
                      : "bg-card border-border hover:bg-secondary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate max-w-[160px]">
                      {tpl.name}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                      {tpl.category}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate font-sans">
                    {tpl.header || tpl.body_template}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Right Column: Editor or Detail View (8 cols) */}
          <div className="md:col-span-8 overflow-y-auto p-4 space-y-4">
            {editorState.isEditing ? (
              /* Editor Form */
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-semibold text-foreground font-mono flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-primary" />
                    <span>Configurar Plantilla</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditorState((prev) => ({ ...prev, isEditing: false }))}
                      className="h-7 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={editorState.isSaving}
                      className="h-7 text-xs bg-primary text-primary-foreground"
                    >
                      {editorState.isSaving ? "Guardando..." : "Guardar Plantilla"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground block mb-1">Nombre</label>
                    <Input
                      placeholder="Ej: Estreno Fin de Semana"
                      value={editorState.name}
                      onChange={(e) => setEditorState((prev) => ({ ...prev, name: e.target.value }))}
                      className="h-8 text-xs font-sans bg-secondary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-foreground block mb-1">Categoría</label>
                    <Select
                      value={editorState.category}
                      onValueChange={(val: any) => setEditorState((prev) => ({ ...prev, category: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs font-sans bg-secondary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="GENERAL">General</SelectItem>
                        <SelectItem value="MIGRATION">Migración de Canales</SelectItem>
                        <SelectItem value="BROADCAST">Difusión / Campañas</SelectItem>
                        <SelectItem value="WATERMARK">Watermark & Video</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Encabezado (Opcional - Se añade arriba)
                  </label>
                  <Input
                    placeholder="Ej: 🎬 ESTRENO EXCLUSIVO"
                    value={editorState.header}
                    onChange={(e) => setEditorState((prev) => ({ ...prev, header: e.target.value }))}
                    className="h-8 text-xs font-sans bg-secondary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-foreground block">
                      Cuerpo del Mensaje (con variables dinámicas)
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Tokens:</span>
                      {["{title}", "{channel}", "{year}", "{date}", "{quality}"].map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => insertToken(token)}
                          className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-primary hover:bg-secondary/80 border border-border"
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Escribí el texto base. Usá {title}, {channel}, etc..."
                    value={editorState.bodyTemplate}
                    onChange={(e) => setEditorState((prev) => ({ ...prev, bodyTemplate: e.target.value }))}
                    className="w-full text-xs font-mono p-2.5 rounded-md bg-secondary/30 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Firma / Pie de Página (Opcional - Se añade al final)
                  </label>
                  <Input
                    placeholder="Ej: 🌟 Canal Oficial: {channel}"
                    value={editorState.signature}
                    onChange={(e) => setEditorState((prev) => ({ ...prev, signature: e.target.value }))}
                    className="h-8 text-xs font-sans bg-secondary/30"
                  />
                </div>
              </div>
            ) : selectedTemplate ? (
              /* Detail / Preview View */
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground font-mono">
                      {selectedTemplate.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {selectedTemplate.category}
                      </Badge>
                      {selectedTemplate.is_default && (
                        <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30">
                          Por Defecto
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartEdit(selectedTemplate)}
                      className="h-8 text-xs flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(selectedTemplate.id)}
                      className="h-8 text-xs text-rose-400 hover:text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    {onSelectTemplate && (
                      <Button
                        size="sm"
                        onClick={() => {
                          onSelectTemplate(selectedTemplate);
                          onClose();
                        }}
                        className="h-8 text-xs bg-primary text-primary-foreground flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Usar Esta Plantilla</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Rendered Preview Box */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Vista Previa Renderizada (Simulando variables)
                  </span>
                  <div className="p-3.5 rounded-lg bg-secondary/30 border border-border text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                    {selectedTemplate.header && (
                      <p className="font-bold text-primary mb-2">{selectedTemplate.header}</p>
                    )}
                    <p className="font-mono text-[11px] text-foreground">
                      {selectedTemplate.body_template
                        .replace(/\{title\}/gi, "Guardianes de la Galaxia Vol. 3")
                        .replace(/\{channel\}/gi, "@PeliculasEstrenosVIP")
                        .replace(/\{year\}/gi, "2026")
                        .replace(/\{date\}/gi, "2026-11-08")
                        .replace(/\{quality\}/gi, "1080p Full HD")}
                    </p>
                    {selectedTemplate.signature && (
                      <p className="mt-3 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                        {selectedTemplate.signature.replace(/\{channel\}/gi, "@PeliculasEstrenosVIP")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-muted-foreground">
                Seleccioná una plantilla de la lista o creá una nueva.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
