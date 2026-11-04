import React, { useState } from "react";
import {
  Layers,
  Tag,
  Hash,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Trash2,
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
import { cn } from "@/shared/lib/utils";

interface OrganizeChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChannelId: number;
  selectedMessages: ChannelMessageItem[];
  channels: Channel[];
  selectedTargetId: number | null;
  onSuccess: () => void;
}

interface FormState {
  activeTab: "inplace" | "album";
  // In-place tagging fields
  tagText: string;
  tagMode: "append" | "prepend" | "replace";
  // Album repacking fields
  albumCaption: string;
  targetId: number;
  deleteOriginals: boolean;
  isScheduled: boolean;
  scheduledAt: string | null;
}

interface AsyncState {
  isSubmitting: boolean;
  feedback: { message: string; type: "success" | "error" } | null;
}

export const OrganizeChannelModal: React.FC<OrganizeChannelModalProps> = ({
  isOpen,
  onClose,
  sourceChannelId,
  selectedMessages,
  channels,
  selectedTargetId,
  onSuccess,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Local form and mode state
  const [formState, setFormState] = useState<FormState>(() => ({
    activeTab: "inplace",
    tagText: "#ejemplo1",
    tagMode: "append",
    albumCaption: "#ejemplo1 ",
    targetId: selectedTargetId || sourceChannelId, // Defaults to target or same channel
    deleteOriginals: true, // Default to true when consolidating in same channel
    isScheduled: false,
    scheduledAt: null,
  }));

  // Hook 2: Async execution and feedback state
  const [asyncState, setAsyncState] = useState<AsyncState>({
    isSubmitting: false,
    feedback: null,
  });

  if (!isOpen) return null;

  const count = selectedMessages.length;
  const isAlbumCountValid = count >= 2 && count <= 10;
  const sourceChannel = channels.find((c) => c.id === sourceChannelId);
  const isSameChannelRepack = formState.targetId === sourceChannelId;

  // Action: In-Place Batch Tagging
  const handleInPlaceTagging = async () => {
    if (!formState.tagText.trim()) {
      setAsyncState({
        isSubmitting: false,
        feedback: { message: "Por favor ingresá un hashtag o texto válido.", type: "error" },
      });
      return;
    }

    setAsyncState({ isSubmitting: true, feedback: null });

    try {
      const messageIds = selectedMessages.map((m) => m.id);
      const res = await migrationApi.batchEditCaptions({
        channel_id: sourceChannelId,
        message_ids: messageIds,
        text: formState.tagText.trim(),
        mode: formState.tagMode,
      });

      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: `¡Se actualizaron exitosamente ${res.updated_count} mensajes con la etiqueta "${formState.tagText.trim()}" directamente en tu canal!`,
          type: "success",
        },
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: err.message || "Error al editar los mensajes en lote",
          type: "error",
        },
      });
    }
  };

  // Action: Album Repacking
  const handlePublishAlbum = async () => {
    if (!formState.targetId) {
      setAsyncState({
        isSubmitting: false,
        feedback: { message: "Por favor seleccioná un canal de destino.", type: "error" },
      });
      return;
    }

    if (!isAlbumCountValid) {
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
        caption: formState.albumCaption.trim(),
        scheduled_at: formState.isScheduled ? formState.scheduledAt : null,
        delete_source_messages: isSameChannelRepack && formState.deleteOriginals,
      });

      const purgeMsg = res.deleted_source_count && res.deleted_source_count > 0
        ? ` y se eliminaron los ${res.deleted_source_count} mensajes sueltos originales.`
        : ".";

      setAsyncState({
        isSubmitting: false,
        feedback: {
          message: res.is_scheduled
            ? `Álbum programado para ${new Date(formState.scheduledAt || "").toLocaleString()}${purgeMsg}`
            : `¡Álbum publicado con éxito (${res.sent_message_ids.length} elementos)${purgeMsg}`,
          type: "success",
        },
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1600);
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
    if (formState.activeTab === "inplace") {
      setFormState((prev) => ({ ...prev, tagText: tag }));
    } else {
      setFormState((prev) => {
        const cur = prev.albumCaption.trim();
        return {
          ...prev,
          albumCaption: cur.includes(tag) ? cur : (cur ? `${cur} ${tag}` : `${tag} `),
        };
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !asyncState.isSubmitting && onClose()}>
      <DialogContent className="max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col p-0 bg-card border-border text-foreground shadow-2xl">
        {/* Header & Mode Switcher */}
        <DialogHeader className="p-4 border-b border-border bg-secondary/30 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                {formState.activeTab === "inplace" ? <Tag className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>Organizar Contenido del Canal</span>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 bg-cyan-500/10 text-[10px] font-mono">
                    {count} seleccionados
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Canal: <strong className="text-foreground">{sourceChannel?.title || `#${sourceChannelId}`}</strong>
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-lg bg-secondary/60 border border-border">
            <button
              type="button"
              onClick={() => setFormState((prev) => ({ ...prev, activeTab: "inplace" }))}
              className={cn(
                "py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                formState.activeTab === "inplace"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
              )}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>1. Etiquetar In-Situ (Sin Reenviar)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormState((prev) => ({ ...prev, activeTab: "album" }))}
              className={cn(
                "py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                formState.activeTab === "album"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2. Reempaquetar en Álbum</span>
            </button>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
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

          {/* Quick Media Summary Bar */}
          <div className="p-2 rounded-lg bg-secondary/30 border border-border flex items-center justify-between text-muted-foreground">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              {count} elementos en selección:
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              {selectedMessages.slice(0, 4).map((m) => (
                <span key={m.id} className="px-1.5 py-0.5 rounded bg-secondary/60 border border-border text-foreground">
                  #{m.id}
                </span>
              ))}
              {count > 4 && <span>+{count - 4} más</span>}
            </div>
          </div>

          {/* TAB 1: IN-PLACE BATCH TAGGING */}
          {formState.activeTab === "inplace" && (
            <div className="space-y-3.5">
              <div className="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/5 text-cyan-300 space-y-1">
                <span className="font-semibold block">⚡ Edición directa sin duplicados:</span>
                <p className="text-[11px] text-muted-foreground">
                  Modifica los mensajes ya publicados en este canal agregándoles la etiqueta. Los usuarios podrán buscar y filtrar por este hashtag de inmediato sin alterar la fecha original.
                </p>
              </div>

              {/* Tagging Mode Selection */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">¿Cómo aplicar la etiqueta?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "append", label: "Anexar al final", desc: "Conserva texto + #tag" },
                    { id: "prepend", label: "Colocar al inicio", desc: "#tag + texto original" },
                    { id: "replace", label: "Reemplazar todo", desc: "Sobrescribe pie de foto" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, tagMode: m.id as any }))}
                      className={cn(
                        "p-2 rounded-lg border text-left transition-all",
                        formState.tagMode === m.id
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-sm"
                          : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      <span className="font-medium text-xs block">{m.label}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag Input */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-cyan-400" />
                  Hashtag o Etiqueta a Inyectar:
                </label>
                <input
                  type="text"
                  value={formState.tagText}
                  onChange={(e) => setFormState((prev) => ({ ...prev, tagText: e.target.value }))}
                  placeholder="Ej: #ejemplo1"
                  disabled={asyncState.isSubmitting}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/60"
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-muted-foreground mr-1">Atajos:</span>
                  {["#ejemplo1", "#temporada1", "#pack", "#destacado", "#curso"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTagPreset(t)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary/70 border border-border text-muted-foreground hover:text-cyan-300 hover:border-cyan-500/30 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SAME-CHANNEL ALBUM REPACKING */}
          {formState.activeTab === "album" && (
            <div className="space-y-3.5">
              {!isAlbumCountValid && (
                <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {count < 2
                      ? "Seleccioná al menos 2 elementos para poder armar un álbum."
                      : `Has seleccionado ${count} elementos. Telegram permite hasta 10 elementos por álbum.`}
                  </span>
                </div>
              )}

              {/* Destination Channel Selector (supports same channel or another) */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Canal de Destino para el Álbum:</label>
                <Select
                  value={String(formState.targetId)}
                  onValueChange={(val) => setFormState((prev) => ({ ...prev, targetId: Number(val) }))}
                  disabled={asyncState.isSubmitting}
                >
                  <SelectTrigger className="w-full bg-secondary/50 border-border text-xs text-foreground h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-48">
                    <SelectItem value={String(sourceChannelId)} className="text-xs font-semibold text-cyan-300">
                      ⭐ En este mismo canal ({sourceChannel?.title || `#${sourceChannelId}`})
                    </SelectItem>
                    {channels
                      .filter((c) => c.id !== sourceChannelId)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                          {c.title} ({c.id})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Same Channel Purge Option */}
              {isSameChannelRepack && (
                <div className="p-3 rounded-lg border border-border bg-secondary/40 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.deleteOriginals}
                      onChange={(e) => setFormState((prev) => ({ ...prev, deleteOriginals: e.target.checked }))}
                      className="mt-0.5 rounded border-border text-cyan-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        Eliminar mensajes sueltos originales tras crear el álbum
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Limpia el canal para que no queden las publicaciones viejas repetidas y solo quede el nuevo Álbum consolidado.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Album Caption Input */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-cyan-400" />
                  Pie de Foto / Hashtag del Álbum:
                </label>
                <textarea
                  rows={2}
                  value={formState.albumCaption}
                  onChange={(e) => setFormState((prev) => ({ ...prev, albumCaption: e.target.value }))}
                  placeholder="Ej: #ejemplo1 Pack especial de fotos y videos..."
                  disabled={asyncState.isSubmitting}
                  className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/60 resize-none"
                />

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground mr-1">Atajos:</span>
                  {["#ejemplo1", "#pack", "#galeria", "#destacado"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTagPreset(t)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary/70 border border-border text-muted-foreground hover:text-cyan-300 hover:border-cyan-500/30 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smart Scheduler */}
              <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-semibold text-foreground">Programar Publicación</span>
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
                    {formState.isScheduled ? "Programado" : "Publicar Ya"}
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
          )}
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

          {formState.activeTab === "inplace" ? (
            <Button
              type="button"
              size="sm"
              onClick={handleInPlaceTagging}
              disabled={asyncState.isSubmitting || !formState.tagText.trim()}
              className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {asyncState.isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando Etiquetas...</span>
                </>
              ) : (
                <>
                  <Tag className="w-3.5 h-3.5" />
                  <span>Guardar Etiquetas In-Situ ({count})</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handlePublishAlbum}
              disabled={asyncState.isSubmitting || !isAlbumCountValid || !formState.targetId}
              className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {asyncState.isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando Álbum...</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {isSameChannelRepack
                      ? `Reempaquetar en Álbum (${count})`
                      : `Publicar Álbum (${count})`}
                  </span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
