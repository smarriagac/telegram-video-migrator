import React, { useState } from "react";
import {
  Wand2,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import { videoProcessingApi } from "../../infrastructure/videoProcessingApi";
import { ChannelMessageItem } from "../../domain/types";
import { Channel } from "@/features/migration/domain/types";

interface VideoSanitizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChannelMessageItem | null;
  sourceChannelId: number;
  channels: Channel[];
  selectedTargetId: number | null;
  onSuccess?: () => void;
}

interface FormState {
  targetId: number;
  filterType: "delogo" | "blur";
  preset: "center" | "top_right" | "bottom_right" | "bottom_bar" | "custom";
  customBox: { x: number; y: number; w: number; h: number };
  caption: string;
}

interface AsyncState {
  isSubmitting: boolean;
  feedback: { message: string; type: "success" | "error" } | null;
}

export const VideoSanitizerModal: React.FC<VideoSanitizerModalProps> = ({
  isOpen,
  onClose,
  message,
  sourceChannelId,
  channels,
  selectedTargetId,
  onSuccess,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Form configuration state
  const [formState, setFormState] = useState<FormState>(() => ({
    targetId: selectedTargetId || channels[0]?.id || 0,
    filterType: "delogo",
    preset: "center",
    customBox: { x: 200, y: 300, w: 400, h: 200 },
    caption: message?.text || "",
  }));

  // Hook 2: Submission and feedback state
  const [asyncState, setAsyncState] = useState<AsyncState>({
    isSubmitting: false,
    feedback: null,
  });

  if (!message) return null;

  const sourceChannel = channels.find((c) => c.id === sourceChannelId);
  const targetChannel = channels.find((c) => c.id === formState.targetId);

  const handleEnqueue = async () => {
    if (!formState.targetId) {
      setAsyncState({
        isSubmitting: false,
        feedback: { message: "Por favor seleccioná un canal destino.", type: "error" },
      });
      return;
    }

    setAsyncState({ isSubmitting: true, feedback: null });
    try {
      const filterParams: Record<string, any> = { preset: formState.preset };
      if (formState.preset === "custom") {
        filterParams.x = formState.customBox.x;
        filterParams.y = formState.customBox.y;
        filterParams.w = formState.customBox.w;
        filterParams.h = formState.customBox.h;
      }

      await videoProcessingApi.enqueue({
        source_channel_id: sourceChannelId,
        source_message_id: message.id,
        target_channel_id: formState.targetId,
        filter_type: formState.filterType,
        filter_params: filterParams,
        source_channel_title: sourceChannel?.title,
        target_channel_title: targetChannel?.title,
        new_caption: formState.caption.trim() || undefined,
      });

      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: "¡Video encolado exitosamente en la cola de procesamiento FFmpeg!",
          type: "success",
        },
      });

      setTimeout(() => {
        setAsyncState({ isSubmitting: false, feedback: null });
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: err.message || "Error al encolar el video para procesamiento.",
          type: "error",
        },
      });
    }
  };

  const thumbUrl = `/api/channels/${sourceChannelId}/messages/${message.id}/thumbnail`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl border-border bg-card max-h-[90vh] flex flex-col p-4 sm:p-5">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Sanitizador de Video FFmpeg</span>
                <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30 font-mono">
                  Quitar Marca de Agua
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Procesamiento asíncrono con FFmpeg para remover o desenfocar logotipos quemados en el video.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 text-xs">
          {/* Target video info banner */}
          <div className="p-2.5 rounded-lg border border-border bg-secondary/30 flex items-center gap-3">
            <div className="w-16 h-12 bg-black rounded overflow-hidden shrink-0 border border-border relative">
              <img
                src={thumbUrl}
                alt={`Miniatura #${message.id}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground font-mono">Mensaje #{message.id}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {message.media_type || "video"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {message.text ? message.text : "(Sin texto adjunto)"}
              </p>
            </div>
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
            <label className="font-semibold text-foreground">Ubicación de la Marca de Agua:</label>
            <Select
              value={formState.preset}
              onValueChange={(val: any) => setFormState((prev) => ({ ...prev, preset: val }))}
            >
              <SelectTrigger className="h-8 text-xs bg-secondary/60 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">🎯 Centro de la pantalla (Logos de texto centrales)</SelectItem>
                <SelectItem value="top_right">↗️ Esquina superior derecha</SelectItem>
                <SelectItem value="bottom_right">↘️ Esquina inferior derecha</SelectItem>
                <SelectItem value="bottom_bar">➖ Banda inferior horizontal</SelectItem>
                <SelectItem value="custom">⚙️ Coordenadas personalizadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom coordinate inputs if custom */}
          {formState.preset === "custom" && (
            <div className="grid grid-cols-4 gap-2 p-2.5 rounded-lg border border-border bg-secondary/20">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground">Pos X (px):</label>
                <Input
                  type="number"
                  value={formState.customBox.x}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      customBox: { ...prev.customBox, x: Number(e.target.value) },
                    }))
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground">Pos Y (px):</label>
                <Input
                  type="number"
                  value={formState.customBox.y}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      customBox: { ...prev.customBox, y: Number(e.target.value) },
                    }))
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground">Ancho (px):</label>
                <Input
                  type="number"
                  value={formState.customBox.w}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      customBox: { ...prev.customBox, w: Number(e.target.value) },
                    }))
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground">Alto (px):</label>
                <Input
                  type="number"
                  value={formState.customBox.h}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      customBox: { ...prev.customBox, h: Number(e.target.value) },
                    }))
                  }
                  className="h-7 text-xs font-mono"
                />
              </div>
            </div>
          )}

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
                  Interpola y difumina bordes circundantes para remover el texto.
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

          {/* Optional Caption */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Descripción / Caption de Destino:</label>
            <Textarea
              rows={2}
              value={formState.caption}
              onChange={(e) => setFormState((prev) => ({ ...prev, caption: e.target.value }))}
              placeholder="Escribí una nueva descripción o dejá la original..."
              className="text-xs bg-secondary/50 border-border"
            />
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
            onClick={handleEnqueue}
            disabled={asyncState.isSubmitting || !formState.targetId}
            size="sm"
            className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          >
            {asyncState.isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Encolando...
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" /> Encolar en Procesador FFmpeg
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
