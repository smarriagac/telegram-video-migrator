import React, { useMemo, useRef, useState } from "react";
import {
  Send,
  Radio,
  Search,
  CheckSquare,
  Square,
  Paperclip,
  Trash2,
  Crown,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
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
import { ChatAvatar } from "@/shared/components/ui/chat-avatar";
import { channelApi } from "@/features/channels/infrastructure/channelApi";
import { cn } from "@/shared/lib/utils";

export interface BroadcastTargetItem {
  id: number;
  title: string;
  username?: string | null;
  type: string;
  can_post: boolean;
  is_creator?: boolean;
  is_admin?: boolean;
  participants_count?: number | null;
  status_text?: string | null;
  avatar_color?: string | null;
  account_id?: number | null;
}

export interface BroadcastMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTargets: BroadcastTargetItem[];
  defaultAccountId?: number | null;
  onSuccess?: () => void;
}

interface FormState {
  selectedTargetIds: number[];
  text: string;
  files: File[];
  filePreviews: Array<{ file: File; url: string; isVideo: boolean }>;
  searchQuery: string;
  filterOnlyOwn: boolean;
}

interface AsyncState {
  isSubmitting: boolean;
  progressText: string;
  feedback: {
    type: "success" | "error" | "info";
    message: string;
    details?: Array<{ target_id: number; status: string; error: string | null }>;
  } | null;
}

const PRESET_HASHTAGS = [
  "#promocion",
  "#oferta",
  "#anuncio",
  "#vip",
  "#sorteo",
  "#nuevo",
  "#contenido",
];

export const BroadcastMessageModal: React.FC<BroadcastMessageModalProps> = ({
  isOpen,
  onClose,
  availableTargets,
  defaultAccountId,
  onSuccess,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: Exactly 2 useState hooks
  // Hook 1: Local form, selections and file attachments state
  const [formState, setFormState] = useState<FormState>(() => {
    // Default to all own channels/groups where can_post is true
    const eligible = availableTargets.filter(
      (t) => t.can_post && (t.type === "channel" || t.type === "group" || t.type === "supergroup")
    );
    const ownIds = eligible.filter((t) => t.is_creator).map((t) => t.id);
    return {
      selectedTargetIds: ownIds.length > 0 ? ownIds : eligible.slice(0, 5).map((t) => t.id),
      text: "",
      files: [],
      filePreviews: [],
      searchQuery: "",
      filterOnlyOwn: false,
    };
  });

  // Hook 2: Async execution, pacing and feedback state
  const [asyncState, setAsyncState] = useState<AsyncState>({
    isSubmitting: false,
    progressText: "",
    feedback: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Eligible targets where sending is permitted
  const eligibleTargets = useMemo(() => {
    return availableTargets.filter(
      (t) => t.can_post && (t.type === "channel" || t.type === "group" || t.type === "supergroup")
    );
  }, [availableTargets]);

  // Filtered targets by search query and own-only filter
  const filteredTargets = useMemo(() => {
    const query = formState.searchQuery.toLowerCase().trim();
    return eligibleTargets.filter((t) => {
      if (formState.filterOnlyOwn && !t.is_creator) return false;
      if (!query) return true;
      return (
        t.title.toLowerCase().includes(query) ||
        (t.username && t.username.toLowerCase().includes(query))
      );
    });
  }, [eligibleTargets, formState.searchQuery, formState.filterOnlyOwn]);

  const toggleTarget = (id: number) => {
    setFormState((prev) => {
      const exists = prev.selectedTargetIds.includes(id);
      return {
        ...prev,
        selectedTargetIds: exists
          ? prev.selectedTargetIds.filter((tid) => tid !== id)
          : [...prev.selectedTargetIds, id],
      };
    });
  };

  const selectAll = () => {
    setFormState((prev) => ({
      ...prev,
      selectedTargetIds: filteredTargets.map((t) => t.id),
    }));
  };

  const deselectAll = () => {
    setFormState((prev) => ({
      ...prev,
      selectedTargetIds: [],
    }));
  };

  const addHashtag = (tag: string) => {
    setFormState((prev) => {
      const cur = prev.text.trim();
      if (cur.includes(tag)) return prev;
      return {
        ...prev,
        text: cur ? `${cur} ${tag}` : `${tag} `,
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    // Limit to max 10 files (Telegram album limitation)
    const combined = [...formState.files, ...selected].slice(0, 10);
    const previews = combined.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      isVideo: file.type.startsWith("video/"),
    }));

    setFormState((prev) => ({
      ...prev,
      files: combined,
      filePreviews: previews,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFormState((prev) => {
      const newFiles = [...prev.files];
      const newPreviews = [...prev.filePreviews];
      if (newPreviews[index]) {
        URL.revokeObjectURL(newPreviews[index].url);
      }
      newFiles.splice(index, 1);
      newPreviews.splice(index, 1);
      return {
        ...prev,
        files: newFiles,
        filePreviews: newPreviews,
      };
    });
  };

  const handleSubmit = async () => {
    if (formState.selectedTargetIds.length === 0) {
      setAsyncState({
        isSubmitting: false,
        progressText: "",
        feedback: {
          type: "error",
          message: "Por favor seleccioná al menos un canal o grupo de destino.",
        },
      });
      return;
    }

    if (!formState.text.trim() && formState.files.length === 0) {
      setAsyncState({
        isSubmitting: false,
        progressText: "",
        feedback: {
          type: "error",
          message: "El mensaje debe contener texto o al menos un archivo multimedia.",
        },
      });
      return;
    }

    setAsyncState({
      isSubmitting: true,
      progressText: `Iniciando difusión a ${formState.selectedTargetIds.length} canales con pacing anti-flood...`,
      feedback: null,
    });

    try {
      const res = await channelApi.broadcastMessage({
        targetIds: formState.selectedTargetIds,
        text: formState.text.trim(),
        files: formState.files,
        accountId: defaultAccountId,
      });

      const succCount = res.successful_count;
      const failCount = res.failed_count;

      setAsyncState({
        isSubmitting: false,
        progressText: "",
        feedback: {
          type: failCount === 0 ? "success" : succCount > 0 ? "info" : "error",
          message:
            failCount === 0
              ? `¡Difusión completada con éxito en los ${succCount} canales seleccionados!`
              : `Difusión procesada: ${succCount} exitoso${succCount > 1 ? "s" : ""}, ${failCount} fallido${failCount > 1 ? "s" : ""}.`,
          details: res.results,
        },
      });

      if (succCount > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setAsyncState({
        isSubmitting: false,
        progressText: "",
        feedback: {
          type: "error",
          message: err.message || "Error al procesar la difusión multicanal.",
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !asyncState.isSubmitting && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col p-0 bg-card border-border text-foreground shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-secondary/30 shrink-0 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>Difusión Multicanal (Broadcast)</span>
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10 text-[10px] font-mono">
                    {formState.selectedTargetIds.length} seleccionados
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Publicá un mensaje simultáneamente en múltiples canales y grupos propios o administrados.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Feedback Banner */}
          {asyncState.feedback && (
            <div
              className={cn(
                "p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in",
                asyncState.feedback.type === "success" &&
                  "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                asyncState.feedback.type === "info" &&
                  "bg-amber-500/10 border-amber-500/30 text-amber-400",
                asyncState.feedback.type === "error" &&
                  "bg-destructive/10 border-destructive/30 text-destructive"
              )}
            >
              {asyncState.feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{asyncState.feedback.message}</p>
                {asyncState.feedback.details && (
                  <div className="mt-2 space-y-1 max-h-28 overflow-y-auto pr-1">
                    {asyncState.feedback.details.map((d) => (
                      <div
                        key={d.target_id}
                        className="text-[11px] font-mono flex items-center justify-between border-b border-border/40 pb-0.5"
                      >
                        <span className="truncate">Canal #{d.target_id}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[10px]",
                            d.status === "success"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-destructive/20 text-destructive"
                          )}
                        >
                          {d.status === "success" ? "Publicado" : d.error || "Fallo"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Destination Channels & Groups Selection */}
          <div className="space-y-2 border border-border rounded-lg p-3 bg-secondary/20">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase text-[11px]">
                <Radio className="w-3.5 h-3.5 text-primary" />
                1. Canales y Grupos Destino ({formState.selectedTargetIds.length} de {eligibleTargets.length})
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFormState((s) => ({ ...s, filterOnlyOwn: !s.filterOnlyOwn }))
                  }
                  className={cn(
                    "h-6 text-[10px] px-2 font-mono rounded",
                    formState.filterOnlyOwn
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Crown className="w-2.5 h-2.5 mr-1" />
                  Solo Propios
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10 font-mono"
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground font-mono"
                >
                  Ninguno
                </Button>
              </div>
            </div>

            {/* Target Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filtrar canales por nombre o usuario..."
                value={formState.searchQuery}
                onChange={(e) => setFormState((s) => ({ ...s, searchQuery: e.target.value }))}
                className="w-full bg-secondary/60 border border-border rounded-md pl-8 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Target Channels List */}
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-border/60 rounded-md p-1 bg-background/50">
              {filteredTargets.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-xs font-mono">
                  No se encontraron canales o grupos habilitados.
                </div>
              ) : (
                filteredTargets.map((target) => {
                  const isSelected = formState.selectedTargetIds.includes(target.id);
                  return (
                    <div
                      key={target.id}
                      onClick={() => toggleTarget(target.id)}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors select-none",
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <ChatAvatar
                          id={target.id}
                          title={target.title}
                          avatarColor={target.avatar_color}
                          accountId={target.account_id}
                          className="w-6 h-6 rounded-md"
                        />
                        <div className="truncate min-w-0">
                          <span className="font-semibold text-foreground text-xs truncate block">
                            {target.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate block">
                            {target.username ? `@${target.username}` : target.status_text || `#${target.id}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {target.is_creator && (
                          <Badge
                            variant="outline"
                            className="text-[8px] font-mono px-1 py-0 border-amber-500/35 text-amber-400 bg-amber-500/10"
                          >
                            <Crown className="w-2 h-2 mr-0.5" />
                            Propio
                          </Badge>
                        )}
                        {!target.is_creator && target.is_admin && (
                          <Badge
                            variant="outline"
                            className="text-[8px] font-mono px-1 py-0 border-primary/35 text-primary bg-primary/10"
                          >
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Step 2: Message Content & Hashtags */}
          <div className="space-y-2 border border-border rounded-lg p-3 bg-secondary/20">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                2. Contenido del Mensaje y Etiquetas
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {formState.text.length} caracteres
              </span>
            </div>

            {/* Hashtag Presets */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-mono mr-1">Insertar:</span>
              {PRESET_HASHTAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addHashtag(tag)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Message Textarea */}
            <textarea
              rows={3}
              placeholder="Escribí aquí el mensaje a difundir con texto, enlaces y #etiquetas..."
              value={formState.text}
              onChange={(e) => setFormState((s) => ({ ...s, text: e.target.value }))}
              className="w-full bg-secondary/60 border border-border rounded-md p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-y"
            />

            {/* Step 3: Attached Media (Photos, Video, GIF) */}
            <div className="space-y-2 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase text-[11px]">
                  <Paperclip className="w-3.5 h-3.5 text-primary" />
                  Archivos Multimedia ({formState.files.length}/10)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={formState.files.length >= 10}
                  className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 font-mono gap-1"
                >
                  <Paperclip className="w-3 h-3" />
                  <span>+ Adjuntar Foto / Video / GIF</span>
                </Button>
              </div>

              {/* Previews Grid */}
              {formState.filePreviews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {formState.filePreviews.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-md overflow-hidden border border-border bg-black aspect-video flex items-center justify-center"
                    >
                      {p.isVideo ? (
                        <video src={p.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={p.url} alt={p.file.name} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="p-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                          title="Eliminar archivo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/70 text-[9px] font-mono text-white truncate max-w-[90%]">
                        {p.file.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {formState.files.length > 1 && (
                <p className="text-[10px] text-primary font-mono">
                  ✨ Los {formState.files.length} archivos se publicarán agrupados como un <strong>Álbum de Telegram</strong> con el mensaje como descripción común.
                </p>
              )}
            </div>
          </div>

          {/* Rate Limit Pacing Notice */}
          <div className="p-2.5 rounded-lg bg-secondary/40 border border-border flex items-center gap-2 text-muted-foreground font-mono text-[10px]">
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              Pacing anti-flood activo: Envío secuencial con 1 segundo de intervalo entre canales para proteger tu cuenta de Telegram.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-3 border-t border-border bg-secondary/30 flex sm:justify-between items-center w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={asyncState.isSubmitting}
            className="text-xs text-muted-foreground"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={asyncState.isSubmitting || formState.selectedTargetIds.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 px-4 flex items-center gap-1.5 shadow-sm"
          >
            {asyncState.isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                <span>Difundiendo ({formState.selectedTargetIds.length})...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Difundir a {formState.selectedTargetIds.length} canales</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
