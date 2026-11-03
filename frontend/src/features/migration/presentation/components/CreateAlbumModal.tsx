import React, { useState } from "react";
import {
  Layers,
  Sparkles,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Video,
  Image as ImageIcon,
  FileText,
  Clock,
  Hash,
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
import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { DateTimePicker } from "@/shared/components/ui/date-time-picker";
import { Channel, ChannelMessageItem } from "@/features/migration/domain/types";
import { migrationApi } from "../../infrastructure/migrationApi";

interface CreateAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChannelId: number;
  selectedMessages: ChannelMessageItem[];
  channels: Channel[];
  selectedTargetId: number | null;
  onSuccess: (sentIds: number[]) => void;
}

interface FormState {
  targetId: number;
  caption: string;
  isScheduled: boolean;
  scheduledAt: string | null;
}

interface AsyncState {
  isSubmitting: boolean;
  feedback: { message: string; type: "success" | "error" } | null;
}

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({
  isOpen,
  onClose,
  sourceChannelId,
  selectedMessages,
  channels,
  selectedTargetId,
  onSuccess,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Local form state
  const [formState, setFormState] = useState<FormState>(() => {
    const validTargets = channels.filter((c) => c.id !== sourceChannelId);
    return {
      targetId: selectedTargetId && selectedTargetId !== sourceChannelId
        ? selectedTargetId
        : validTargets[0]?.id || 0,
      caption: "#ejemplo1 ",
      isScheduled: false,
      scheduledAt: null,
    };
  });

  // Hook 2: Async execution and feedback state
  const [asyncState, setAsyncState] = useState<AsyncState>({
    isSubmitting: false,
    feedback: null,
  });

  if (!isOpen) return null;

  const validTargetChannels = channels.filter((c) => c.id !== sourceChannelId);
  const targetChannel = channels.find((c) => c.id === formState.targetId);
  const sourceChannel = channels.find((c) => c.id === sourceChannelId);

  const count = selectedMessages.length;
  const isCountValid = count >= 2 && count <= 10;

  const handlePublishAlbum = async () => {
    if (!formState.targetId) {
      setAsyncState({
        isSubmitting: false,
        feedback: { message: "Por favor seleccioná un canal destino válido.", type: "error" },
      });
      return;
    }

    if (!isCountValid) {
      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: count < 2
            ? "Telegram requiere al menos 2 elementos multimedia para armar un álbum."
            : "Telegram permite como máximo 10 elementos multimedia por álbum.",
          type: "error",
        },
      });
      return;
    }

    setAsyncState({ isSubmitting: true, feedback: null });

    try {
      const messageIds = selectedMessages.map((m) => m.id);
      const res = await migrationApi.publishAlbum({
        source_channel_id: sourceChannelId,
        target_channel_id: formState.targetId,
        message_ids: messageIds,
        caption: formState.caption.trim(),
        scheduled_at: formState.isScheduled ? formState.scheduledAt : null,
      });

      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: res.is_scheduled
            ? `Álbum programado con éxito para ${new Date(formState.scheduledAt || "").toLocaleString()}.`
            : `¡Álbum publicado exitosamente con ${res.sent_message_ids.length} elementos en ${targetChannel?.title || "canal destino"}!`,
          type: "success",
        },
      });

      setTimeout(() => {
        onSuccess(res.sent_message_ids);
        onClose();
      }, 1500);
    } catch (err: any) {
      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: err.message || "Error al publicar el álbum en Telegram",
          type: "error",
        },
      });
    }
  };

  const addTagPreset = (tag: string) => {
    setFormState((prev) => {
      const current = prev.caption.trim();
      if (current.includes(tag)) return prev;
      return {
        ...prev,
        caption: current ? `${current} ${tag}` : `${tag} `,
      };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !asyncState.isSubmitting && onClose()}>
      <DialogContent className="max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col p-0 bg-card border-border text-foreground shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-secondary/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>Agrupar Contenido en Álbum (MediaGroup)</span>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 bg-cyan-500/10 text-[10px] font-mono">
                    {count} elementos
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Publicá los elementos seleccionados en una sola cuadrícula visual con un pie de foto / hashtag compartido.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Validation Banner if outside 2..10 */}
          {!isCountValid && (
            <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {count < 2
                  ? "Seleccioná al menos 2 imágenes o videos para poder crear un álbum."
                  : `Has seleccionado ${count} elementos. El límite estricto del protocolo MTProto de Telegram es de 10 elementos por álbum.`}
              </span>
            </div>
          )}

          {/* Feedback Banner */}
          {asyncState.feedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                asyncState.feedback.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              {asyncState.feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="font-medium">{asyncState.feedback.message}</span>
            </div>
          )}

          {/* Selected Media Preview Grid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Elementos a agrupar ({count}):
              </span>
              <span className="text-[11px] font-mono">
                {sourceChannel?.title || `Canal #${sourceChannelId}`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1.5 bg-secondary/30 rounded-lg border border-border">
              {selectedMessages.map((msg, index) => {
                const isVideo = msg.media_type === "video";
                const isPhoto = msg.media_type === "photo";
                return (
                  <div
                    key={msg.id}
                    className="relative rounded-md border border-border/80 bg-card p-1.5 flex flex-col justify-between overflow-hidden shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono font-bold text-cyan-400">
                        #{index + 1}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground truncate">
                        id:{msg.id}
                      </span>
                    </div>

                    <div className="h-10 rounded bg-secondary/60 flex items-center justify-center text-muted-foreground my-0.5">
                      {isVideo ? (
                        <Video className="w-4 h-4 text-purple-400" />
                      ) : isPhoto ? (
                        <ImageIcon className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-amber-400" />
                      )}
                    </div>

                    <p className="text-[9px] text-muted-foreground truncate font-mono mt-0.5" title={msg.text || "Sin texto"}>
                      {msg.text ? msg.text.slice(0, 20) : `[${msg.media_type || "media"}]`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Caption & Hashtag Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                Mensaje / Hashtag Compartido del Álbum:
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {formState.caption.length}/1024 caracteres
              </span>
            </div>

            <textarea
              rows={3}
              value={formState.caption}
              onChange={(e) => setFormState((prev) => ({ ...prev, caption: e.target.value }))}
              placeholder="Escribí el hashtag y mensaje que acompañará a este álbum (ej: #ejemplo1 Curso de trading parte 1)..."
              disabled={asyncState.isSubmitting}
              className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 resize-none font-sans transition-all"
            />

            {/* Quick Tag Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-1">
                Atajos:
              </span>
              {["#ejemplo1", "#pack", "#galeria", "#destacado", "#temporada1"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTagPreset(t)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary/70 border border-border text-muted-foreground hover:text-cyan-300 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Destination Channel Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Canal Destino de Publicación:</label>
            <Select
              value={String(formState.targetId)}
              onValueChange={(val) => setFormState((prev) => ({ ...prev, targetId: Number(val) }))}
              disabled={asyncState.isSubmitting || validTargetChannels.length === 0}
            >
              <SelectTrigger className="w-full bg-secondary/50 border-border text-xs text-foreground h-9">
                <SelectValue placeholder="Seleccioná un canal de destino..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-48">
                {validTargetChannels.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                    {c.title} ({c.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduling Switch & DateTimePicker */}
          <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-foreground">Programar Publicación (Smart Scheduler)</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    isScheduled: !prev.isScheduled,
                    scheduledAt: !prev.isScheduled ? new Date(Date.now() + 15 * 60000).toISOString() : null,
                  }))
                }
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono border transition-all ${
                  formState.isScheduled
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {formState.isScheduled ? "Programación Activa" : "Publicar Inmediato"}
              </button>
            </div>

            {formState.isScheduled && (
              <div className="pt-1.5">
                <DateTimePicker
                  value={formState.scheduledAt}
                  onChange={(date) =>
                    setFormState((prev) => ({
                      ...prev,
                      scheduledAt: date ? date.toISOString() : null,
                    }))
                  }
                  placeholder="Seleccionar fecha y horario..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-3 border-t border-border bg-secondary/20 flex flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={asyncState.isSubmitting}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePublishAlbum}
            disabled={asyncState.isSubmitting || !isCountValid || !formState.targetId}
            className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
          >
            {asyncState.isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Publicando Álbum...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Publicar Álbum ({count})</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
