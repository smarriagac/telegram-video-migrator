import React, { useState } from "react";
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
import { ArrowRight, Sparkles } from "lucide-react";

export const CreateSyncBindingModal: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 compound state used)
  const [formData, setFormData] = useState({
    sourceChannelId: "",
    sourceChannelTitle: "",
    targetChannelId: "",
    targetChannelTitle: "",
    stripLinks: true,
    allowVideo: true,
    allowPhoto: true,
    allowDocument: true,
  });

  const { isCreateModalOpen, setCreateModalOpen, createBinding, isLoading } =
    useSyncStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sourceChannelId || !formData.targetChannelId) return;

    await createBinding({
      source_channel_id: parseInt(formData.sourceChannelId.trim(), 10),
      source_channel_title: formData.sourceChannelTitle.trim() || undefined,
      target_channel_id: parseInt(formData.targetChannelId.trim(), 10),
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
      sourceChannelId: "",
      sourceChannelTitle: "",
      targetChannelId: "",
      targetChannelTitle: "",
      stripLinks: true,
      allowVideo: true,
      allowPhoto: true,
      allowDocument: true,
    });
  };

  return (
    <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
      <DialogContent className="sm:max-w-[520px] bg-zinc-950 border-zinc-800 text-zinc-100 rounded-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Vincular Nuevo Par de Sincronización en Vivo
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Establece un enlace continuo entre un canal origen y uno destino mediante eventos MTProto push en tiempo real.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Channel IDs Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Canal Origen (ID) <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="-1001234567890"
                value={formData.sourceChannelId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sourceChannelId: e.target.value }))
                }
                required
                className="bg-zinc-900 border-zinc-800 text-white font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Canal Destino (ID) <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="-1009876543210"
                value={formData.targetChannelId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetChannelId: e.target.value }))
                }
                required
                className="bg-zinc-900 border-zinc-800 text-white font-mono text-xs"
              />
            </div>
          </div>

          {/* Channel Titles Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Título Origen (Opcional)
              </label>
              <Input
                placeholder="Canal Principal Noticas"
                value={formData.sourceChannelTitle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sourceChannelTitle: e.target.value }))
                }
                className="bg-zinc-900 border-zinc-800 text-white text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Título Destino (Opcional)
              </label>
              <Input
                placeholder="Canal Backup Espejo"
                value={formData.targetChannelTitle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetChannelTitle: e.target.value }))
                }
                className="bg-zinc-900 border-zinc-800 text-white text-xs"
              />
            </div>
          </div>

          {/* Pipeline Defaults */}
          <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 p-3 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
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
              disabled={isLoading || !formData.sourceChannelId || !formData.targetChannelId}
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
