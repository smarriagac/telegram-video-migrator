import React, { useState } from "react";
import {
  Wand2,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Layers2,
  SlidersVertical,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { videoProcessingApi } from "../../infrastructure/videoProcessingApi";
import { Channel } from "@/features/migration/domain/types";

interface BatchSanitizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMessageIds: number[];
  sourceChannelId: number;
  channels: Channel[];
  selectedTargetId: number | null;
  onSuccess?: () => void;
}

interface FormState {
  targetId: number;
  filterType: "delogo" | "blur";
  preset: "auto" | "center" | "top_right" | "bottom_right" | "bottom_bar";
  resolutionPreset: "AUTO_MOBILE" | "H265_720P" | "H265_1080P" | "ORIGINAL" | "1080p" | "720p" | "480p" | string;
  aspectRatioMode: "ORIGINAL" | "9:16_BLUR" | "9:16_CROP";
}

interface AsyncState {
  isSubmitting: boolean;
  feedback: { message: string; type: "success" | "error" } | null;
}

export const BatchSanitizerModal: React.FC<BatchSanitizerModalProps> = ({
  isOpen,
  onClose,
  selectedMessageIds,
  sourceChannelId,
  channels,
  selectedTargetId,
  onSuccess,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Form state
  const [formState, setFormState] = useState<FormState>(() => ({
    targetId: selectedTargetId || channels[0]?.id || 0,
    filterType: "delogo",
    preset: "auto",
    resolutionPreset: "ORIGINAL",
    aspectRatioMode: "ORIGINAL",
  }));

  // Hook 2: Async execution and feedback state
  const [asyncState, setAsyncState] = useState<AsyncState>({
    isSubmitting: false,
    feedback: null,
  });

  if (!selectedMessageIds.length) return null;

  const sourceChannel = channels.find((c) => c.id === sourceChannelId);
  const targetChannel = channels.find((c) => c.id === formState.targetId);

  const handleEnqueueBatch = async () => {
    if (!formState.targetId) {
      setAsyncState({
        isSubmitting: false,
        feedback: { message: "Por favor seleccioná un canal destino.", type: "error" },
      });
      return;
    }

    setAsyncState({ isSubmitting: true, feedback: null });
    try {
      const res = await videoProcessingApi.enqueueBatch({
        source_channel_id: sourceChannelId,
        source_message_ids: selectedMessageIds,
        target_channel_id: formState.targetId,
        filter_type: formState.filterType,
        filter_params: {
          preset: formState.preset,
          auto_detect: formState.preset === "auto",
          resolution_preset: formState.resolutionPreset,
          ...(formState.aspectRatioMode !== "ORIGINAL" ? { aspect_ratio_mode: formState.aspectRatioMode } : {}),
        },
        resolution_preset: formState.resolutionPreset,
        source_channel_title: sourceChannel?.title,
        target_channel_title: targetChannel?.title,
      });

      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: `¡Se encolaron exitosamente ${res.enqueued_count} de ${selectedMessageIds.length} elementos para procesamiento asíncrono con FFmpeg!`,
          type: "success",
        },
      });

      setTimeout(() => {
        setAsyncState({ isSubmitting: false, feedback: null });
        if (onSuccess) onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: err.message || "Error al encolar el lote de elementos.",
          type: "error",
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl border-border bg-card max-h-[90vh] flex flex-col p-4 sm:p-5">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Layers2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Sanitizador en Lote FFmpeg</span>
                <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30 font-mono">
                  {selectedMessageIds.length} Elementos
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Procesar múltiples videos y fotos seleccionados eliminando marcas de agua en segundo plano con control de concurrencia seguro.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 text-xs">
          {/* Summary Box */}
          <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-950/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-purple-200">
                Resumen de la Operación en Lote
              </span>
              <span className="font-mono text-purple-300 font-bold">
                {selectedMessageIds.length} mensajes seleccionados
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Cada video o foto será descargado, sanitizado con el filtro seleccionado y publicado en el canal destino de forma secuencial (1 elemento a la vez) para no sobrecargar el CPU del VPS.
            </p>
          </div>

          {/* Destination Channel Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-primary" />
              <span>Canal Destino de Publicación:</span>
            </label>
            <Select
              value={String(formState.targetId)}
              onValueChange={(val) => setFormState((prev) => ({ ...prev, targetId: Number(val) }))}
            >
              <SelectTrigger className="h-8 text-xs bg-secondary/60 border-border">
                <SelectValue placeholder="Seleccionar canal destino" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.title} {c.username ? `(@${c.username})` : `[ID: ${c.id}]`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Watermark position preset */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Modo de Detección & Ubicación:</label>
            <Select
              value={formState.preset}
              onValueChange={(val: any) => setFormState((prev) => ({ ...prev, preset: val }))}
            >
              <SelectTrigger className="h-8 text-xs bg-secondary/60 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  ✨ Auto-Detección Inteligente para cada elemento (Recomendado)
                </SelectItem>
                <SelectItem value="center">
                  🎯 Centro de la pantalla (Fijo en todos)
                </SelectItem>
                <SelectItem value="top_right">
                  ↗️ Esquina superior derecha (Fijo en todos)
                </SelectItem>
                <SelectItem value="bottom_right">
                  ↘️ Esquina inferior derecha (Fijo en todos)
                </SelectItem>
                <SelectItem value="bottom_bar">
                  ➖ Banda inferior horizontal (Fijo en todos)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {formState.preset === "auto"
                ? "Cada video y foto será analizado individualmente para ubicar y remover su marca específica."
                : "Se aplicará la misma región fija a todos los elementos del lote."}
            </p>
          </div>

          {/* Filter method */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Método de Filtro FFmpeg:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormState((prev) => ({ ...prev, filterType: "delogo" }))}
                className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-0.5 ${
                  formState.filterType === "delogo"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="font-semibold flex items-center gap-1.5 text-primary">
                  <Sparkles className="w-3.5 h-3.5" /> Delogo Inteligente
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Interpola bordes circundantes para remover el texto o logotipo.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormState((prev) => ({ ...prev, filterType: "blur" }))}
                className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-0.5 ${
                  formState.filterType === "blur"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="font-semibold flex items-center gap-1.5 text-amber-400">
                  <Layers className="w-3.5 h-3.5" /> Desenfoque (BoxBlur)
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Aplica un filtro gaussiano difuso sobre la marca de agua.
                </span>
              </button>
            </div>
          </div>

          {/* Transcoding & Resolution Downsampling Preset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <SlidersVertical className="w-3.5 h-3.5 text-primary" />
                <span>Resolución y Transcodificación (Lote):</span>
              </label>
              <span className="text-[10px] font-mono text-muted-foreground">
                H.264 / AAC
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "AUTO_MOBILE", label: "Auto H.265", desc: "-50% peso (Óptimo)", isH265: true },
                { id: "H265_720P", label: "720p H.265", desc: "Móvil ultrarrápido", isH265: true },
                { id: "ORIGINAL", label: "Original", desc: "Sin escalar" },
                { id: "720p", label: "720p H.264", desc: "Compatibilidad" },
              ].map((res) => {
                const selected = formState.resolutionPreset === res.id;
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => setFormState((prev) => ({ ...prev, resolutionPreset: res.id as any }))}
                    className={`p-2 rounded-lg border text-left transition-colors flex flex-col gap-0.5 ${
                      selected
                        ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground font-mono">{res.label}</span>
                      {res.isH265 && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                          HEVC
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{res.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect Ratio / Telegram Stories 9:16 Selector (Batch) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Formato / Stories 9:16 (Lote):</span>
              </label>
              <span className="text-[10px] font-mono text-muted-foreground">
                Vertical 9:16
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "ORIGINAL", label: "Original", desc: "Sin alterar" },
                { id: "9:16_BLUR", label: "Stories (Blur)", desc: "Lienzo 9:16 con fondo borroso" },
                { id: "9:16_CROP", label: "Stories (Crop)", desc: "Recorte 9:16 centrado" },
              ].map((ar) => {
                const selected = formState.aspectRatioMode === ar.id;
                return (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setFormState((prev) => ({ ...prev, aspectRatioMode: ar.id as any }))}
                    className={`p-2 rounded-lg border text-left transition-colors flex flex-col gap-0.5 ${
                      selected
                        ? "border-sky-500 bg-sky-500/10 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground font-mono">{ar.label}</span>
                    <span className="text-[10px] text-muted-foreground">{ar.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback banner */}
          {asyncState.feedback && (
            <div
              className={`p-2.5 rounded-md border text-xs flex items-center gap-2 ${
                asyncState.feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {asyncState.feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              )}
              <span>{asyncState.feedback.message}</span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border flex sm:justify-between items-center w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={asyncState.isSubmitting} className="text-xs">
            Cancelar
          </Button>
          <Button
            onClick={handleEnqueueBatch}
            disabled={asyncState.isSubmitting || !formState.targetId}
            size="sm"
            className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          >
            {asyncState.isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Encolando lote...
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" /> Encolar {selectedMessageIds.length} Elementos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
