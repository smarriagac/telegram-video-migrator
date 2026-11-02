import React, { useEffect, useState } from "react";
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
import { useMigrationStore } from "@/features/migration/application/useMigrationStore";
import { SearchableChannelSelect } from "@/features/migration/presentation/components/SearchableChannelSelect";
import { ArrowRight, Sparkles } from "lucide-react";

export const CreateSyncBindingModal: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 compound state used)
  const [formData, setFormData] = useState({
    sourceChannelId: null as number | null,
    sourceChannelTitle: "",
    manualSourceId: "",
    isManualSource: false,
    targetChannelId: null as number | null,
    targetChannelTitle: "",
    manualTargetId: "",
    isManualTarget: false,
    stripLinks: true,
    allowVideo: true,
    allowPhoto: true,
    allowDocument: true,
  });

  const { isCreateModalOpen, setCreateModalOpen, createBinding, isLoading } =
    useSyncStore();
  const channels = useMigrationStore((state) => state.channels);
  const fetchChannels = useMigrationStore((state) => state.fetchChannels);

  useEffect(() => {
    if (isCreateModalOpen && channels.length === 0) {
      fetchChannels();
    }
  }, [isCreateModalOpen, channels.length, fetchChannels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sourceId = formData.isManualSource
      ? parseInt(formData.manualSourceId.trim(), 10)
      : formData.sourceChannelId;
    const targetId = formData.isManualTarget
      ? parseInt(formData.manualTargetId.trim(), 10)
      : formData.targetChannelId;

    if (!sourceId || !targetId || isNaN(sourceId) || isNaN(targetId)) return;

    await createBinding({
      source_channel_id: sourceId,
      source_channel_title: formData.sourceChannelTitle.trim() || undefined,
      target_channel_id: targetId,
      target_channel_title: formData.targetChannelTitle.trim() || undefined,
      is_active: true,
      caption_rules: {
        strip_links: formData.stripLinks,
      },
      media_filter_rules: {
        allow_video: formData.allowVideo,
        allow_photo: formData.allowPhoto,
        allow_document: formData.allowDocument,
      },
    });

    setFormData({
      sourceChannelId: null,
      sourceChannelTitle: "",
      manualSourceId: "",
      isManualSource: false,
      targetChannelId: null,
      targetChannelTitle: "",
      manualTargetId: "",
      isManualTarget: false,
      stripLinks: true,
      allowVideo: true,
      allowPhoto: true,
      allowDocument: true,
    });
  };

  const isSourceValid = formData.isManualSource
    ? Boolean(formData.manualSourceId.trim() && !isNaN(parseInt(formData.manualSourceId.trim(), 10)))
    : Boolean(formData.sourceChannelId);

  const isTargetValid = formData.isManualTarget
    ? Boolean(formData.manualTargetId.trim() && !isNaN(parseInt(formData.manualTargetId.trim(), 10)))
    : Boolean(formData.targetChannelId);

  const isSubmitDisabled = isLoading || !isSourceValid || !isTargetValid;

  return (
    <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
      <DialogContent className="sm:max-w-[540px] bg-zinc-950 border-zinc-800 text-zinc-100 rounded-md">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Vincular Nuevo Par de Sincronización en Vivo
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Establece un enlace continuo entre un canal origen y uno destino mediante eventos MTProto push en tiempo real.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          {/* Channel Selectors / Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Source Channel Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">
                  Canal Origen <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      isManualSource: !prev.isManualSource,
                    }))
                  }
                  className="text-[10px] font-mono text-cyan-400 hover:underline"
                >
                  {formData.isManualSource ? "Buscar en lista" : "ID manual"}
                </button>
              </div>

              {formData.isManualSource ? (
                <Input
                  placeholder="-1001234567890"
                  value={formData.manualSourceId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, manualSourceId: e.target.value }))
                  }
                  required
                  className="bg-zinc-900 border-zinc-800 text-white font-mono text-xs h-8"
                />
              ) : (
                <SearchableChannelSelect
                  value={formData.sourceChannelId}
                  onChange={(id) => {
                    const ch = channels.find((c) => c.id === id);
                    setFormData((prev) => ({
                      ...prev,
                      sourceChannelId: id,
                      sourceChannelTitle: ch?.title || prev.sourceChannelTitle,
                    }));
                  }}
                  channels={channels}
                  disabledId={formData.targetChannelId}
                  placeholder="Buscar canal origen..."
                  accentColor="cyan"
                />
              )}
            </div>

            {/* Target Channel Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">
                  Canal Destino <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      isManualTarget: !prev.isManualTarget,
                    }))
                  }
                  className="text-[10px] font-mono text-emerald-400 hover:underline"
                >
                  {formData.isManualTarget ? "Buscar en lista" : "ID manual"}
                </button>
              </div>

              {formData.isManualTarget ? (
                <Input
                  placeholder="-1009876543210"
                  value={formData.manualTargetId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, manualTargetId: e.target.value }))
                  }
                  required
                  className="bg-zinc-900 border-zinc-800 text-white font-mono text-xs h-8"
                />
              ) : (
                <SearchableChannelSelect
                  value={formData.targetChannelId}
                  onChange={(id) => {
                    const ch = channels.find((c) => c.id === id);
                    setFormData((prev) => ({
                      ...prev,
                      targetChannelId: id,
                      targetChannelTitle: ch?.title || prev.targetChannelTitle,
                    }));
                  }}
                  channels={channels}
                  disabledId={formData.sourceChannelId}
                  placeholder="Buscar canal destino..."
                  accentColor="emerald"
                />
              )}
            </div>
          </div>

          {/* Channel Titles Grid (Auto-populated or customized) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                <span>Título Origen</span>
                <span className="text-[10px] text-zinc-500 font-mono">Autocompletado</span>
              </label>
              <Input
                placeholder="Nombre del canal origen"
                value={formData.sourceChannelTitle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sourceChannelTitle: e.target.value }))
                }
                className="bg-zinc-900/80 border-zinc-800 text-white text-xs h-7.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                <span>Título Destino</span>
                <span className="text-[10px] text-zinc-500 font-mono">Autocompletado</span>
              </label>
              <Input
                placeholder="Nombre del canal destino"
                value={formData.targetChannelTitle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetChannelTitle: e.target.value }))
                }
                className="bg-zinc-900/80 border-zinc-800 text-white text-xs h-7.5"
              />
            </div>
          </div>

          {/* Pipeline Defaults */}
          <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 p-2.5 sm:p-3 space-y-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block font-mono">
              Reglas Iniciales de Pipeline
            </span>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Limpiar enlaces externos (anti-spam)</span>
              <Switch
                checked={formData.stripLinks}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, stripLinks: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Sincronizar Videos</span>
              <Switch
                checked={formData.allowVideo}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, allowVideo: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Sincronizar Fotos e Imágenes</span>
              <Switch
                checked={formData.allowPhoto}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, allowPhoto: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Sincronizar Documentos y Archivos</span>
              <Switch
                checked={formData.allowDocument}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, allowDocument: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitDisabled}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isLoading ? "Creando enlace..." : "Vincular y Activar Daemon"}
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
