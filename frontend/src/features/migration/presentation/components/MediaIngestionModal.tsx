import React, { useEffect, useState } from "react";
import {
  DownloadCloud,
  Share2,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Stamp,
  ExternalLink,
  Clock,
  User as UserIcon,
  Scissors,
  Image as ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { Channel } from "@/features/migration/domain/types";
import {
  mediaIngestionApi,
  IngestionMetadata,
} from "../../infrastructure/mediaIngestionApi";

interface MediaIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  selectedTargetId: number | null;
  defaultAccountId?: number | null;
  onSuccess?: () => void;
}

interface IngestionModalState {
  targetChannelId: number;
  mode: "DIRECT" | "RESERVOIR";
  aspectRatioMode: "ORIGINAL" | "9:16_BLUR" | "9:16_CROP";
  brandingText: string;
  captionOverride: string;
  sliceStories: boolean;
  sliceDispatchMode: "ALBUM" | "SEQUENTIAL";
  burnSubtitles: boolean;
  subtitleStyle: "KINETIC_YELLOW" | "CLASSIC_WHITE" | "BOXED_BLACK";
  generateThumbnail: boolean;
  isInspecting: boolean;
  isSubmitting: boolean;
  metadata: IngestionMetadata | null;
  feedback: { message: string; type: "success" | "error" } | null;
}

export const MediaIngestionModal: React.FC<MediaIngestionModalProps> = ({
  isOpen,
  onClose,
  channels,
  selectedTargetId,
  defaultAccountId,
  onSuccess,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Raw URL input
  const [url, setUrl] = useState<string>("");

  // Hook 2: Consolidated modal lifecycle and form configuration
  const [state, setState] = useState<IngestionModalState>(() => {
    const initTarget = selectedTargetId || channels[0]?.id || 0;
    const chan = channels.find((c) => c.id === initTarget);
    const tag = chan?.username
      ? `@${chan.username}`
      : chan?.title
      ? `@${chan.title.replace(/\s+/g, "")}`
      : "@CanalVIP";

    return {
      targetChannelId: initTarget,
      mode: "DIRECT",
      aspectRatioMode: "9:16_BLUR",
      brandingText: tag,
      captionOverride: "",
      sliceStories: true,
      sliceDispatchMode: "ALBUM",
      burnSubtitles: false,
      subtitleStyle: "KINETIC_YELLOW",
      generateThumbnail: true,
      isInspecting: false,
      isSubmitting: false,
      metadata: null,
      feedback: null,
    };
  });

  useEffect(() => {
    if (isOpen && selectedTargetId) {
      setState((prev) => ({
        ...prev,
        targetChannelId: selectedTargetId,
      }));
    }
  }, [isOpen, selectedTargetId]);

  if (!isOpen) return null;

  const handleInspect = async () => {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setState((prev) => ({
        ...prev,
        feedback: { message: "Por favor pegá una URL válida de TikTok, Reels o Shorts.", type: "error" },
      }));
      return;
    }

    setState((prev) => ({ ...prev, isInspecting: true, feedback: null }));
    try {
      const meta = await mediaIngestionApi.inspectUrl(cleanUrl);
      setState((prev) => ({
        ...prev,
        isInspecting: false,
        metadata: meta,
        captionOverride: prev.captionOverride || meta.title || "",
        feedback: {
          message: `¡Video identificado con éxito! Plataforma: ${meta.platform.toUpperCase()}`,
          type: "success",
        },
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isInspecting: false,
        feedback: {
          message: err.message || "No se pudo extraer información del video.",
          type: "error",
        },
      }));
    }
  };

  const handleStage = async () => {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setState((prev) => ({
        ...prev,
        feedback: { message: "Ingresá la URL del video para procesar.", type: "error" },
      }));
      return;
    }

    if (!state.targetChannelId) {
      setState((prev) => ({
        ...prev,
        feedback: { message: "Seleccioná un canal de Telegram de destino.", type: "error" },
      }));
      return;
    }

    setState((prev) => ({ ...prev, isSubmitting: true, feedback: null }));
    try {
      const targetChan = channels.find((c) => c.id === state.targetChannelId);
      const resolvedAccountId = targetChan?.account_id || defaultAccountId || undefined;

      const res = await mediaIngestionApi.stage({
        url: cleanUrl,
        target_channel_id: state.targetChannelId,
        mode: state.mode,
        aspect_ratio_mode: state.aspectRatioMode,
        branding_text: state.brandingText.trim() || undefined,
        caption_override: state.captionOverride.trim() || undefined,
        account_id: resolvedAccountId,
        slice_stories: state.sliceStories,
        slice_dispatch_mode: state.sliceDispatchMode,
        burn_subtitles: state.burnSubtitles,
        subtitle_style: state.subtitleStyle,
        generate_thumbnail: state.generateThumbnail,
      });

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        feedback: {
          message: `¡Video ingestado y enviado a Telegram correctamente! (Msg ID: #${res.message_id || "OK"})`,
          type: "success",
        },
      }));

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        feedback: {
          message: err.message || "Error al ingestar y publicar el video en Telegram.",
          type: "error",
        },
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl border-border bg-card max-h-[90vh] flex flex-col p-4 sm:p-5">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/30">
              <DownloadCloud className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Ingestor Multiplataforma & Telegram Stories 9:16
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Descargá clips de TikTok, Reels y YouTube Shorts, aplicales formato 9:16 y publicalos en Telegram.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3.5 py-3 pr-1 text-xs">
          {/* URL Input and Inspect Button */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground flex items-center justify-between">
              <span>URL del Video (TikTok / Reels / Shorts / X):</span>
              <span className="text-[10px] text-muted-foreground font-mono">yt-dlp core</span>
            </label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@usuario/video/123... o Instagram Reel"
                className="h-8 text-xs bg-secondary/50 border-border flex-1"
                disabled={state.isInspecting || state.isSubmitting}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleInspect}
                disabled={state.isInspecting || state.isSubmitting || !url.trim()}
                className="h-8 px-3 text-xs gap-1.5 shrink-0"
              >
                {state.isInspecting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                )}
                Inspeccionar
              </Button>
            </div>
          </div>

          {/* Video Metadata Preview Card */}
          {state.metadata && (
            <div className="p-3 rounded-lg border border-pink-500/20 bg-pink-500/5 flex gap-3 items-center">
              {state.metadata.thumbnail ? (
                <img
                  src={state.metadata.thumbnail}
                  alt="Thumbnail"
                  className="w-16 h-24 object-cover rounded border border-border shrink-0"
                />
              ) : (
                <div className="w-16 h-24 bg-secondary/80 rounded border border-border flex items-center justify-center shrink-0 text-muted-foreground text-[10px]">
                  Sin preview
                </div>
              )}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 border-pink-500/40 text-pink-400 bg-pink-500/10">
                    {state.metadata.platform}
                  </Badge>
                  {state.metadata.duration > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {state.metadata.duration}s
                    </span>
                  )}
                  {state.metadata.uploader && (
                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5 truncate">
                      <UserIcon className="w-3 h-3" /> {state.metadata.uploader}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-foreground line-clamp-2">
                  {state.metadata.title}
                </p>
                <a
                  href={state.metadata.webpage_url || url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-pink-400 hover:underline flex items-center gap-1"
                >
                  Ver enlace original <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          )}

          {/* Target Channel */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Canal de Telegram Destino:</label>
            <Select
              value={state.targetChannelId.toString()}
              onValueChange={(val) =>
                setState((prev) => ({ ...prev, targetChannelId: Number(val) }))
              }
            >
              <SelectTrigger className="h-8 text-xs bg-secondary/50 border-border">
                <SelectValue placeholder="Seleccioná un canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.title} {c.username ? `(@${c.username})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ingestion Mode */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Modo de Publicación:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, mode: "DIRECT" }))}
                className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-0.5 ${
                  state.mode === "DIRECT"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="font-semibold text-xs flex items-center gap-1.5 text-primary">
                  <Share2 className="w-3.5 h-3.5" /> Publicación Inmediata
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Se envía de inmediato al canal de Telegram seleccionado.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, mode: "RESERVOIR" }))}
                className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-0.5 ${
                  state.mode === "RESERVOIR"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="font-semibold text-xs flex items-center gap-1.5 text-pink-400">
                  <Layers className="w-3.5 h-3.5" /> Reservorio Telegram
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Almacena el clip para goteo programado en campañas de difusión.
                </span>
              </button>
            </div>
          </div>

          {/* Stories 9:16 Aspect Ratio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Formato / Telegram Stories (9:16):</span>
              </label>
              <span className="text-[10px] font-mono text-muted-foreground">FFmpeg Canvas</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "ORIGINAL", label: "Original", desc: "Sin alterar relación" },
                { id: "9:16_BLUR", label: "Stories (Blur)", desc: "Lienzo 9:16 con fondo borroso" },
                { id: "9:16_CROP", label: "Stories (Crop)", desc: "Recorte 9:16 centrado" },
              ].map((ar) => {
                const selected = state.aspectRatioMode === ar.id;
                return (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, aspectRatioMode: ar.id as any }))}
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

          {/* Story Slicer 60s & Media Group Sequencer */}
          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                Story Slicer 60s (Segmentación Inteligente)
              </span>
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, sliceStories: !prev.sliceStories }))}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors cursor-pointer border ${
                  state.sliceStories
                    ? "bg-amber-500 text-black font-semibold border-amber-400"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                {state.sliceStories ? "ACTIVADO (60s)" : "DESACTIVADO"}
              </button>
            </div>

            {state.metadata && state.metadata.duration > 60 && (
              <div className="text-[11px] text-amber-300/90 font-mono bg-amber-500/10 p-2 rounded border border-amber-500/30 flex items-center justify-between">
                <span>⏱️ Duración: {state.metadata.duration}s</span>
                <span>Dividido en {Math.ceil(state.metadata.duration / 60)} partes de 60s</span>
              </div>
            )}

            {state.sliceStories && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground">Forma de Despacho:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, sliceDispatchMode: "ALBUM" }))}
                    className={`p-2 rounded border text-left transition-colors flex flex-col gap-0.5 ${
                      state.sliceDispatchMode === "ALBUM"
                        ? "border-amber-400 bg-amber-500/10 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground font-mono">Álbum (Media Group)</span>
                    <span className="text-[10px] text-muted-foreground">Envía todas las partes juntas en un solo post</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, sliceDispatchMode: "SEQUENTIAL" }))}
                    className={`p-2 rounded border text-left transition-colors flex flex-col gap-0.5 ${
                      state.sliceDispatchMode === "SEQUENTIAL"
                        ? "border-amber-400 bg-amber-500/10 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground font-mono">Secuencial (Parte 1/N)</span>
                    <span className="text-[10px] text-muted-foreground">Mensajes consecutivos con etiquetas individuales</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Subtitles & Kinetic Captions Burner */}
          <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-yellow-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                Subtítulos Cinéticos (Auto Burn-in)
              </span>
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, burnSubtitles: !prev.burnSubtitles }))}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors cursor-pointer border ${
                  state.burnSubtitles
                    ? "bg-yellow-500 text-black font-semibold border-yellow-400"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                {state.burnSubtitles ? "ACTIVADO" : "DESACTIVADO"}
              </button>
            </div>

            {state.burnSubtitles && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground">Estilo Visual de Subtítulos:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, subtitleStyle: "KINETIC_YELLOW" }))}
                    className={`p-2 rounded border text-left transition-colors flex flex-col gap-0.5 ${
                      state.subtitleStyle === "KINETIC_YELLOW"
                        ? "border-yellow-400 bg-yellow-500/10 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="font-semibold text-xs text-yellow-300 font-mono">Kinetic Yellow</span>
                    <span className="text-[10px] text-muted-foreground">Amarillo Stories con contorno</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, subtitleStyle: "CLASSIC_WHITE" }))}
                    className={`p-2 rounded border text-left transition-colors flex flex-col gap-0.5 ${
                      state.subtitleStyle === "CLASSIC_WHITE"
                        ? "border-white bg-white/10 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground font-mono">Classic White</span>
                    <span className="text-[10px] text-muted-foreground">Blanco nítido moderno</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, subtitleStyle: "BOXED_BLACK" }))}
                    className={`p-2 rounded border text-left transition-colors flex flex-col gap-0.5 ${
                      state.subtitleStyle === "BOXED_BLACK"
                        ? "border-zinc-400 bg-zinc-500/20 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="font-semibold text-xs text-foreground font-mono">Caja Oscura</span>
                    <span className="text-[10px] text-muted-foreground">Fondo traslúcido legible</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Smart Poster Frame Thumbnail Option */}
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                Portada Nítida (Anti-cuadro negro):
              </span>
              <span className="text-[10px] text-muted-foreground">
                Extrae un fotograma clave del video para el preview de Telegram
              </span>
            </div>
            <button
              type="button"
              onClick={() => setState((prev) => ({ ...prev, generateThumbnail: !prev.generateThumbnail }))}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors cursor-pointer border ${
                state.generateThumbnail
                  ? "bg-emerald-500 text-black font-semibold border-emerald-400"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {state.generateThumbnail ? "ACTIVADO" : "DESACTIVADO"}
            </button>
          </div>

          {/* Branding overlay */}
          <div className="space-y-1">
            <label className="font-semibold text-foreground flex items-center gap-1.5">
              <Stamp className="w-3.5 h-3.5 text-purple-400" />
              <span>Firma / Branding de Marca:</span>
            </label>
            <Input
              type="text"
              value={state.brandingText}
              onChange={(e) => setState((prev) => ({ ...prev, brandingText: e.target.value }))}
              placeholder="@CanalOficial"
              className="h-7 text-xs font-mono bg-secondary/50 border-border"
            />
          </div>

          {/* Caption */}
          <div className="space-y-1">
            <label className="font-semibold text-foreground">Descripción / Caption de Destino:</label>
            <Textarea
              rows={2}
              value={state.captionOverride}
              onChange={(e) => setState((prev) => ({ ...prev, captionOverride: e.target.value }))}
              placeholder="Descripción del video en Telegram..."
              className="text-xs bg-secondary/50 border-border"
            />
          </div>

          {/* Feedback banner */}
          {state.feedback && (
            <div
              className={`p-2.5 rounded-md border text-xs flex items-center gap-2 ${
                state.feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {state.feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              )}
              <span>{state.feedback.message}</span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border flex sm:justify-between items-center w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={state.isSubmitting}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            size="sm"
            onClick={handleStage}
            disabled={state.isSubmitting || !url.trim()}
            className="text-xs gap-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold shadow-md shadow-pink-500/20"
          >
            {state.isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <DownloadCloud className="w-3.5 h-3.5" />
            )}
            {state.isSubmitting ? "Ingestando..." : "Ingestar y Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
