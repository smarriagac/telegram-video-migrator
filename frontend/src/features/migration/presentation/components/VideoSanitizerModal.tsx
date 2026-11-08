import React, { useState } from "react";
import {
  Wand2,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Scan,
  Type,
  Stamp,
  SlidersVertical,
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
  filterType: "delogo" | "blur" | "watermark_text" | "delogo_and_watermark";
  preset: "center" | "top_right" | "bottom_right" | "bottom_bar" | "custom";
  resolutionPreset: "AUTO_MOBILE" | "H265_720P" | "H265_1080P" | "ORIGINAL" | "1080p" | "720p" | "480p" | string;
  customBox: { x: number; y: number; w: number; h: number };
  normalizedBox?: { x_pct: number; y_pct: number; w_pct: number; h_pct: number } | null;
  caption: string;
  watermarkText: string;
  watermarkPosition: "bottom_right" | "top_right" | "bottom_left" | "top_left" | "center";
}

interface AsyncState {
  isSubmitting: boolean;
  isDetecting: boolean;
  detectionInfo: { text?: string | null; confidence: number; method?: string } | null;
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
  const [formState, setFormState] = useState<FormState>(() => {
    const initTargetId = selectedTargetId || channels[0]?.id || 0;
    const defaultTarget = channels.find((c) => c.id === initTargetId);
    const defaultTag = defaultTarget?.username
      ? `@${defaultTarget.username}`
      : defaultTarget?.title
      ? `@${defaultTarget.title.replace(/\s+/g, "")}`
      : "@CanalVIP";

    return {
      targetId: initTargetId,
      filterType: "delogo",
      preset: "center",
      resolutionPreset: "ORIGINAL",
      customBox: { x: 200, y: 300, w: 400, h: 200 },
      normalizedBox: null,
      caption: message?.text || "",
      watermarkText: defaultTag,
      watermarkPosition: "bottom_right",
    };
  });

  // Hook 2: Submission and async detection state
  const [asyncState, setAsyncState] = useState<AsyncState>({
    isSubmitting: false,
    isDetecting: false,
    detectionInfo: null,
    feedback: null,
  });

  if (!message) return null;

  const sourceChannel = channels.find((c) => c.id === sourceChannelId);
  const targetChannel = channels.find((c) => c.id === formState.targetId);

  const handleAutoDetect = async () => {
    setAsyncState((prev) => ({ ...prev, isDetecting: true, feedback: null }));
    try {
      const res = await videoProcessingApi.detectWatermark({
        source_channel_id: sourceChannelId,
        source_message_id: message.id,
      });

      if (res.detected && res.box) {
        setFormState((prev) => ({
          ...prev,
          preset: res.preset === "custom" || res.preset === "top_left" ? "center" : res.preset,
          customBox: res.box || prev.customBox,
          normalizedBox: res.normalized_box || null,
        }));
        setAsyncState((prev) => ({
          ...prev,
          isDetecting: false,
          detectionInfo: {
            text: res.text,
            confidence: res.confidence,
            method: res.method,
          },
          feedback: {
            message: `¡Marca detectada automáticamente con ${(res.confidence * 100).toFixed(0)}% de confianza! Ubicación ajustada.`,
            type: "success",
          },
        }));
      } else {
        setAsyncState((prev) => ({
          ...prev,
          isDetecting: false,
          feedback: {
            message: res.message || "No se detectó texto con suficiente confianza; usando zona central.",
            type: "success",
          },
        }));
      }
    } catch (err: any) {
      setAsyncState((prev) => ({
        ...prev,
        isDetecting: false,
        feedback: {
          message: err.message || "Error al ejecutar detección automática.",
          type: "error",
        },
      }));
    }
  };

  const handleEnqueue = async () => {
    if (!formState.targetId) {
      setAsyncState((prev) => ({
        ...prev,
        isSubmitting: false,
        feedback: { message: "Por favor seleccioná un canal destino.", type: "error" },
      }));
      return;
    }

    setAsyncState((prev) => ({ ...prev, isSubmitting: true, feedback: null }));
    try {
      const filterParams: Record<string, any> = { preset: formState.preset };
      if (formState.preset === "custom") {
        filterParams.x = formState.customBox.x;
        filterParams.y = formState.customBox.y;
        filterParams.w = formState.customBox.w;
        filterParams.h = formState.customBox.h;
      }
      if (formState.normalizedBox) {
        filterParams.normalized_box = formState.normalizedBox;
      }
      if (
        formState.filterType === "watermark_text" ||
        formState.filterType === "delogo_and_watermark"
      ) {
        filterParams.watermark_text = formState.watermarkText.trim();
        filterParams.watermark_position = formState.watermarkPosition;
      }
      if (formState.resolutionPreset) {
        filterParams.resolution_preset = formState.resolutionPreset;
      }

      await videoProcessingApi.enqueue({
        source_channel_id: sourceChannelId,
        source_message_id: message.id,
        target_channel_id: formState.targetId,
        filter_type: formState.filterType,
        filter_params: filterParams,
        resolution_preset: formState.resolutionPreset,
        source_channel_title: sourceChannel?.title,
        target_channel_title: targetChannel?.title,
        new_caption: formState.caption.trim() || undefined,
      });

      setAsyncState((prev) => ({
        ...prev,
        isSubmitting: false,
        feedback: {
          message: "¡Video encolado exitosamente en la cola de procesamiento FFmpeg!",
          type: "success",
        },
      }));

      setTimeout(() => {
        setAsyncState((prev) => ({ ...prev, isSubmitting: false, feedback: null }));
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setAsyncState((prev) => ({
        ...prev,
        isSubmitting: false,
        feedback: {
          message: err.message || "Error al encolar el video para procesamiento.",
          type: "error",
        },
      }));
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
          {/* Target video info banner with watermark detector box overlay */}
          <div className="p-2.5 rounded-lg border border-border bg-secondary/30 flex items-center gap-3">
            <div className="w-20 h-16 bg-black rounded overflow-hidden shrink-0 border border-border relative">
              <img
                src={thumbUrl}
                alt={`Miniatura #${message.id}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              {/* Highlight box if detected */}
              {formState.normalizedBox && (
                <div
                  className="absolute border-2 border-dashed border-amber-400 bg-amber-400/25 rounded pointer-events-none transition-all"
                  style={{
                    left: `${formState.normalizedBox.x_pct * 100}%`,
                    top: `${formState.normalizedBox.y_pct * 100}%`,
                    width: `${formState.normalizedBox.w_pct * 100}%`,
                    height: `${formState.normalizedBox.h_pct * 100}%`,
                  }}
                  title="Zona detectada automáticamente"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground font-mono">Mensaje #{message.id}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoDetect}
                  disabled={asyncState.isDetecting || asyncState.isSubmitting}
                  className="h-6 px-2 text-[10px] gap-1 font-mono border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                  title="Detectar automáticamente coordenadas del logo con visión por computadora"
                >
                  {asyncState.isDetecting ? (
                    <>
                      <RefreshCw className="w-2.5 h-2.5 animate-spin text-purple-400" />
                      <span>Detectando...</span>
                    </>
                  ) : (
                    <>
                      <Scan className="w-2.5 h-2.5 text-amber-400" />
                      <span>Auto-detectar con IA</span>
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {message.text ? message.text : "(Sin texto adjunto)"}
              </p>
              {asyncState.detectionInfo && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-400 font-mono">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    Detección: {(asyncState.detectionInfo.confidence * 100).toFixed(0)}%
                    {asyncState.detectionInfo.text ? ` (${asyncState.detectionInfo.text.slice(0, 30)})` : ""}
                  </span>
                </div>
              )}
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
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground">Ubicación de la Marca de Agua:</label>
              {formState.normalizedBox && (
                <span className="text-[10px] text-amber-400 font-mono">
                  ✓ Coordenadas IA aplicadas
                </span>
              )}
            </div>
            <Select
              value={formState.preset}
              onValueChange={(val: any) =>
                setFormState((prev) => ({
                  ...prev,
                  preset: val,
                  normalizedBox: val === "custom" ? prev.normalizedBox : null,
                }))
              }
            >
              <SelectTrigger className="h-8 text-xs bg-secondary/60 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">🎯 Centro de la pantalla (Logos de texto centrales)</SelectItem>
                <SelectItem value="top_right">↗️ Esquina superior derecha</SelectItem>
                <SelectItem value="bottom_right">↘️ Esquina inferior derecha</SelectItem>
                <SelectItem value="bottom_bar">➖ Banda inferior horizontal</SelectItem>
                <SelectItem value="custom">⚙️ Coordenadas personalizadas (o detectadas por IA)</SelectItem>
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
            <label className="font-semibold text-foreground">Acción de Procesamiento / Branding:</label>
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
                <span className="font-semibold flex items-center gap-1.5 text-primary text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> Quitar Marca (Delogo)
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Interpola bordes para eliminar el logotipo original.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormState((prev) => ({ ...prev, filterType: "delogo_and_watermark" }))}
                className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-0.5 ${
                  formState.filterType === "delogo_and_watermark"
                    ? "border-purple-500 bg-purple-500/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="font-semibold flex items-center gap-1.5 text-purple-400 text-xs">
                  <Stamp className="w-3.5 h-3.5" /> Limpiar + Branding
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Borra el logo previo y estampa tu @Canal en 1 paso.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormState((prev) => ({ ...prev, filterType: "watermark_text" }))}
                className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-0.5 ${
                  formState.filterType === "watermark_text"
                    ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="font-semibold flex items-center gap-1.5 text-emerald-400 text-xs">
                  <Type className="w-3.5 h-3.5" /> Solo Estampar Branding
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Inyecta tu marca de agua / @Canal sin modificar el video base.
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
                <span className="font-semibold flex items-center gap-1.5 text-amber-400 text-xs">
                  <Layers className="w-3.5 h-3.5" /> Desenfoque (BoxBlur)
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Aplica un filtro difuso sobre la marca de agua.
                </span>
              </button>
            </div>
          </div>

          {/* Branding Options when watermark_text or delogo_and_watermark */}
          {(formState.filterType === "watermark_text" || formState.filterType === "delogo_and_watermark") && (
            <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                  <Stamp className="w-3.5 h-3.5 text-purple-400" />
                  Configuración de Marca / Branding
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  FFmpeg drawtext
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground">Texto de Marca (@Canal / Firma):</label>
                  <Input
                    type="text"
                    value={formState.watermarkText}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, watermarkText: e.target.value }))
                    }
                    placeholder="@MiCanalVIP"
                    className="h-7 text-xs font-mono bg-secondary/60"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground">Posición en Pantalla:</label>
                  <Select
                    value={formState.watermarkPosition}
                    onValueChange={(val: any) =>
                      setFormState((prev) => ({ ...prev, watermarkPosition: val }))
                    }
                  >
                    <SelectTrigger className="h-7 text-xs bg-secondary/60 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom_right">↘️ Inferior Derecha (Estándar)</SelectItem>
                      <SelectItem value="top_right">↗️ Superior Derecha</SelectItem>
                      <SelectItem value="bottom_left">↙️ Inferior Izquierda</SelectItem>
                      <SelectItem value="top_left">↖️ Superior Izquierda</SelectItem>
                      <SelectItem value="center">🎯 Centro de Pantalla</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Transcoding & Resolution Downsampling Preset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <SlidersVertical className="w-3.5 h-3.5 text-primary" />
                <span>Resolución y Transcodificación:</span>
              </label>
              <span className="text-[10px] font-mono text-muted-foreground">
                H.264 / AAC Adaptativo
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
