import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { useSyncStore } from "../../application/useSyncStore";
import { Sliders, Save } from "lucide-react";

export const SyncRulesModal: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 used)
  const {
    selectedBinding,
    isRulesModalOpen,
    setRulesModalOpen,
    updateRules,
    isLoading,
  } = useSyncStore();

  const [rules, setRules] = useState({
    headerText: "",
    footerText: "",
    stripLinks: true,
    stripTags: false,
    allowVideo: true,
    allowPhoto: true,
    allowDocument: true,
  });

  useEffect(() => {
    if (selectedBinding) {
      setRules({
        headerText: selectedBinding.caption_rules?.header_text || "",
        footerText: selectedBinding.caption_rules?.footer_text || "",
        stripLinks: selectedBinding.caption_rules?.strip_links ?? true,
        stripTags: selectedBinding.caption_rules?.strip_tags ?? false,
        allowVideo: selectedBinding.media_filter_rules?.allow_video ?? true,
        allowPhoto: selectedBinding.media_filter_rules?.allow_photo ?? true,
        allowDocument: selectedBinding.media_filter_rules?.allow_document ?? true,
      });
    }
  }, [selectedBinding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBinding) return;

    await updateRules(
      selectedBinding.source_channel_id,
      selectedBinding.target_channel_id,
      {
        caption_rules: {
          header_text: rules.headerText || undefined,
          footer_text: rules.footerText || undefined,
          strip_links: rules.stripLinks,
          strip_tags: rules.stripTags,
        },
        media_filter_rules: {
          allow_video: rules.allowVideo,
          allow_photo: rules.allowPhoto,
          allow_document: rules.allowDocument,
        },
      }
    );
  };

  return (
    <Dialog open={isRulesModalOpen} onOpenChange={setRulesModalOpen}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100 rounded-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Sliders className="h-5 w-5 text-cyan-400" />
            Configuración de Pipeline y Filtros
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Reglas de transformación aplicadas en tiempo real para el canal {selectedBinding?.source_channel_title || selectedBinding?.source_channel_id}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Caption Rules */}
          <div className="space-y-3 rounded-md border border-zinc-800/80 bg-zinc-900/40 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
              Reglas de Caption & Texto
            </span>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-300">Encabezado Automático (Header)</label>
              <Input
                placeholder="🔥 Exclusivo de Mi Red:"
                value={rules.headerText}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, headerText: e.target.value }))
                }
                className="bg-zinc-900 border-zinc-800 text-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-300">Pie de Mensaje (Footer / Firma)</label>
              <Input
                placeholder="Únete a nuestro canal: @canal_oficial"
                value={rules.footerText}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, footerText: e.target.value }))
                }
                className="bg-zinc-900 border-zinc-800 text-white text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-zinc-300">Eliminar enlaces externos (URLs)</span>
              <Switch
                checked={rules.stripLinks}
                onCheckedChange={(checked) =>
                  setRules((prev) => ({ ...prev, stripLinks: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Remover hashtags y menciones (@user)</span>
              <Switch
                checked={rules.stripTags}
                onCheckedChange={(checked) =>
                  setRules((prev) => ({ ...prev, stripTags: checked }))
                }
              />
            </div>
          </div>

          {/* Media Filter Rules */}
          <div className="space-y-3 rounded-md border border-zinc-800/80 bg-zinc-900/40 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
              Tipos de Medios Permitidos
            </span>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Videos & GIFs</span>
              <Switch
                checked={rules.allowVideo}
                onCheckedChange={(checked) =>
                  setRules((prev) => ({ ...prev, allowVideo: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Fotos & Álbumes</span>
              <Switch
                checked={rules.allowPhoto}
                onCheckedChange={(checked) =>
                  setRules((prev) => ({ ...prev, allowPhoto: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Documentos & Archivos adjuntos</span>
              <Switch
                checked={rules.allowDocument}
                onCheckedChange={(checked) =>
                  setRules((prev) => ({ ...prev, allowDocument: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRulesModalOpen(false)}
              className="border-border bg-secondary text-secondary-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {isLoading ? "Guardando..." : "Guardar Reglas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
