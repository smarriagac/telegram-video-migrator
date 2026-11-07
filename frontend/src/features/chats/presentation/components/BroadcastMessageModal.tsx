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
  Eye,
  Calendar,
  Repeat,
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
import { Switch } from "@/shared/components/ui/switch";
import { ChatAvatar } from "@/shared/components/ui/chat-avatar";
import { channelApi, ScheduledBroadcastCampaign } from "@/features/channels/infrastructure/channelApi";
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
  isScheduled: boolean;
  scheduledAt: string;
  recurrence: "ONCE" | "EVERY_6_HOURS" | "EVERY_12_HOURS" | "DAILY" | "WEEKLY";
  campaignName: string;
  activeTab: "compose" | "scheduled";
}

interface AsyncState {
  isSubmitting: boolean;
  progressText: string;
  feedback: {
    type: "success" | "error" | "info";
    message: string;
    details?: Array<{ target_id: number; status: string; error: string | null }>;
  } | null;
  scheduledCampaigns: ScheduledBroadcastCampaign[];
  isLoadingCampaigns: boolean;
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

// Helper to format text with live Telegram-style links, hashtags and mentions
function formatTelegramText(text: string) {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s]+|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <span key={i} className="text-primary underline break-all font-medium">
          {part}
        </span>
      );
    }
    if (part.startsWith("#")) {
      return (
        <span key={i} className="text-cyan-400 font-semibold hover:underline">
          {part}
        </span>
      );
    }
    if (part.startsWith("@")) {
      return (
        <span key={i} className="text-primary font-semibold hover:underline">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

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
    const eligible = availableTargets.filter(
      (t) => t.can_post && (t.type === "channel" || t.type === "group" || t.type === "supergroup")
    );
    const ownIds = eligible.filter((t) => t.is_creator).map((t) => t.id);
    const defDate = new Date(Date.now() + 3600 * 1000);
    defDate.setMinutes(defDate.getMinutes() - defDate.getTimezoneOffset());
    return {
      selectedTargetIds: ownIds.length > 0 ? ownIds : eligible.slice(0, 5).map((t) => t.id),
      text: "",
      files: [],
      filePreviews: [],
      searchQuery: "",
      filterOnlyOwn: false,
      isScheduled: false,
      scheduledAt: defDate.toISOString().slice(0, 16),
      recurrence: "ONCE",
      campaignName: "",
      activeTab: "compose",
    };
  });

  // Hook 2: Async execution, pacing and feedback state
  const [asyncState, setAsyncState] = useState<AsyncState>({
    isSubmitting: false,
    progressText: "",
    feedback: null,
    scheduledCampaigns: [],
    isLoadingCampaigns: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCampaigns = async () => {
    setAsyncState((prev) => ({ ...prev, isLoadingCampaigns: true }));
    try {
      const items = await channelApi.listScheduledBroadcasts();
      setAsyncState((prev) => ({ ...prev, scheduledCampaigns: items, isLoadingCampaigns: false }));
    } catch {
      setAsyncState((prev) => ({ ...prev, isLoadingCampaigns: false }));
    }
  };

  const handleCancelCampaign = async (campaignId: string) => {
    try {
      await channelApi.cancelScheduledBroadcast(campaignId);
      await loadCampaigns();
    } catch (e: any) {
      console.error("Error cancelling scheduled broadcast:", e);
    }
  };

  // Eligible targets where sending is permitted
  const eligibleTargets = useMemo(() => {
    return availableTargets.filter(
      (t) => t.can_post && (t.type === "channel" || t.type === "group" || t.type === "supergroup")
    );
  }, [availableTargets]);

  // First selected target for realistic preview header
  const firstTarget = useMemo(() => {
    return eligibleTargets.find((t) => formState.selectedTargetIds.includes(t.id)) || eligibleTargets[0];
  }, [eligibleTargets, formState.selectedTargetIds]);

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
      setAsyncState((prev) => ({
        ...prev,
        isSubmitting: false,
        progressText: "",
        feedback: {
          type: "error",
          message: "Por favor seleccioná al menos un canal o grupo de destino.",
        },
      }));
      return;
    }

    if (!formState.text.trim() && formState.files.length === 0) {
      setAsyncState((prev) => ({
        ...prev,
        isSubmitting: false,
        progressText: "",
        feedback: {
          type: "error",
          message: "El mensaje debe contener texto o al menos un archivo multimedia.",
        },
      }));
      return;
    }

    if (formState.isScheduled) {
      if (!formState.scheduledAt) {
        setAsyncState((prev) => ({
          ...prev,
          isSubmitting: false,
          progressText: "",
          feedback: {
            type: "error",
            message: "Por favor indicá la fecha y hora programada.",
          },
        }));
        return;
      }

      setAsyncState((prev) => ({
        ...prev,
        isSubmitting: true,
        progressText: "Guardando y programando campaña de difusión...",
        feedback: null,
      }));

      try {
        const utcDate = new Date(formState.scheduledAt).toISOString();
        const created = await channelApi.scheduleBroadcast({
          targetIds: formState.selectedTargetIds,
          text: formState.text.trim(),
          scheduledAt: utcDate,
          recurrence: formState.recurrence,
          name: formState.campaignName.trim() || undefined,
          files: formState.files,
          accountId: defaultAccountId,
        });

        setAsyncState((prev) => ({
          ...prev,
          isSubmitting: false,
          progressText: "",
          feedback: {
            type: "success",
            message: `¡Campaña "${created.name || 'Difusión'}" programada con éxito para ${new Date(created.scheduled_at).toLocaleString()}!`,
          },
        }));

        if (onSuccess) onSuccess();
      } catch (err: any) {
        setAsyncState((prev) => ({
          ...prev,
          isSubmitting: false,
          progressText: "",
          feedback: {
            type: "error",
            message: err.message || "Error al programar la campaña de difusión.",
          },
        }));
      }
      return;
    }

    setAsyncState((prev) => ({
      ...prev,
      isSubmitting: true,
      progressText: `Iniciando difusión a ${formState.selectedTargetIds.length} canales con pacing anti-flood...`,
      feedback: null,
    }));

    try {
      const res = await channelApi.broadcastMessage({
        targetIds: formState.selectedTargetIds,
        text: formState.text.trim(),
        files: formState.files,
        accountId: defaultAccountId,
      });

      const succCount = res.successful_count;
      const failCount = res.failed_count;

      setAsyncState((prev) => ({
        ...prev,
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
      }));

      if (succCount > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setAsyncState((prev) => ({
        ...prev,
        isSubmitting: false,
        progressText: "",
        feedback: {
          type: "error",
          message: err.message || "Error al procesar la difusión multicanal.",
        },
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !asyncState.isSubmitting && onClose()}>
      <DialogContent className="max-w-4xl lg:max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col p-0 bg-card border-border text-foreground shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-secondary/30 shrink-0 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
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
                  Componé o programá difusiones recurrentes con previsualización en vivo MTProto.
                </DialogDescription>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-secondary/80 border border-border">
              <button
                type="button"
                onClick={() => setFormState((s) => ({ ...s, activeTab: "compose" }))}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer",
                  formState.activeTab === "compose"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Redactar Difusión
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormState((s) => ({ ...s, activeTab: "scheduled" }));
                  loadCampaigns();
                }}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer",
                  formState.activeTab === "scheduled"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Campañas Programadas</span>
                {asyncState.scheduledCampaigns.length > 0 && (
                  <Badge variant="secondary" className="px-1 py-0 text-[9px] font-mono">
                    {asyncState.scheduledCampaigns.length}
                  </Badge>
                )}
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: 2-Column Layout (Editor vs Live Simulator) */}
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

          {formState.activeTab === "scheduled" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground text-xs">
                    Campañas Programadas y Recurrentes
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    El servicio daemon MTProto procesará automáticamente estas difusiones en sus fechas e intervalos configurados.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadCampaigns}
                  disabled={asyncState.isLoadingCampaigns}
                  className="h-7 text-xs gap-1 border-border font-mono cursor-pointer"
                >
                  <Clock className={cn("w-3 h-3", asyncState.isLoadingCampaigns && "animate-spin")} />
                  <span>Actualizar</span>
                </Button>
              </div>

              {asyncState.isLoadingCampaigns ? (
                <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Cargando campañas...</span>
                </div>
              ) : asyncState.scheduledCampaigns.length === 0 ? (
                <div className="p-10 border border-dashed border-border rounded-lg text-center space-y-2">
                  <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    No tenés campañas programadas activas en este momento.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormState((s) => ({ ...s, activeTab: "compose", isScheduled: true }))}
                    className="text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    + Programar Nueva Difusión
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {asyncState.scheduledCampaigns.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-border bg-secondary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate max-w-[220px]">
                            {c.name || "Difusión Programada"}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-mono px-1.5 py-0.2",
                              c.status === "SCHEDULED" && "border-primary/40 bg-primary/10 text-primary",
                              c.status === "RUNNING" && "border-amber-500/40 bg-amber-500/10 text-amber-400 animate-pulse",
                              c.status === "COMPLETED" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                              c.status === "FAILED" && "border-destructive/40 bg-destructive/10 text-destructive"
                            )}
                          >
                            {c.status}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0.2 gap-1">
                            <Repeat className="w-2.5 h-2.5" />
                            {c.recurrence === "ONCE"
                              ? "Una sola vez"
                              : c.recurrence === "EVERY_6_HOURS"
                              ? "Cada 6h"
                              : c.recurrence === "EVERY_12_HOURS"
                              ? "Cada 12h"
                              : c.recurrence === "DAILY"
                              ? "Diario"
                              : c.recurrence}
                          </Badge>
                        </div>

                        <p className="text-[11px] text-muted-foreground truncate max-w-[400px]">
                          {c.text || "(Solo multimedia)"}
                        </p>

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono flex-wrap">
                          <span>Destinos: <strong>{c.target_ids.length} canales</strong></span>
                          <span>Próximo: <strong>{new Date(c.scheduled_at).toLocaleString()}</strong></span>
                          <span>Ejecuciones: <strong>{c.run_count}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelCampaign(c.id)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Cancelar y eliminar campaña"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          <span>Cancelar</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* 2-Column Split: Form (Left) & Live Telegram Post Simulator (Right) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Form Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              {/* Step 1: Destination Channels & Groups Selection */}
              <div className="space-y-2 border border-border rounded-lg p-3 bg-secondary/20">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase text-[11px]">
                    <Radio className="w-3.5 h-3.5 text-primary" />
                    1. Destinos ({formState.selectedTargetIds.length} de {eligibleTargets.length})
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
                        "h-6 text-[10px] px-2 font-mono rounded cursor-pointer",
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
                      className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10 font-mono cursor-pointer"
                    >
                      Todos
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={deselectAll}
                      className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground font-mono cursor-pointer"
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
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-border/60 rounded-md p-1 bg-background/50">
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
                            "flex items-center justify-between p-1.5 px-2 rounded-md cursor-pointer transition-colors select-none",
                            isSelected
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted/50 border border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <ChatAvatar
                              id={target.id}
                              title={target.title}
                              avatarColor={target.avatar_color}
                              accountId={target.account_id}
                              className="w-5 h-5 rounded-md"
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
                    2. Contenido del Mensaje
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formState.text.length} / {formState.files.length > 0 ? "1024 (caption)" : "4096"} chars
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
                  rows={4}
                  placeholder="Escribí aquí el mensaje con texto, emojis, enlaces t.me/... y #etiquetas (la imagen o video es opcional)..."
                  value={formState.text}
                  onChange={(e) => setFormState((s) => ({ ...s, text: e.target.value }))}
                  className="w-full bg-secondary/60 border border-border rounded-md p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-y min-h-[90px]"
                />

                {/* Step 3: Attached Media (Photos, Video, GIF - Optional) */}
                <div className="space-y-2 pt-1 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase text-[11px]">
                      <Paperclip className="w-3.5 h-3.5 text-primary" />
                      3. Multimedia Opcional ({formState.files.length}/10)
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
                      className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 font-mono gap-1 cursor-pointer"
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>+ Adjuntar Foto / Video / GIF</span>
                    </Button>
                  </div>

                  {/* Previews Grid */}
                  {formState.filePreviews.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
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
                              className="p-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
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

                {/* Step 4: Programación y Recurrencia */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      4. Programación y Recurrencia
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formState.isScheduled ? "Programado" : "Inmediato"}
                      </span>
                      <Switch
                        checked={formState.isScheduled}
                        onCheckedChange={(checked) =>
                          setFormState((s) => ({ ...s, isScheduled: checked }))
                        }
                      />
                    </div>
                  </div>

                  {formState.isScheduled && (
                    <div className="space-y-2.5 p-3 rounded-md bg-secondary/40 border border-border/60">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] text-muted-foreground font-mono block mb-1">
                            Fecha y Hora de Inicio
                          </label>
                          <input
                            type="datetime-local"
                            value={formState.scheduledAt}
                            onChange={(e) =>
                              setFormState((s) => ({ ...s, scheduledAt: e.target.value }))
                            }
                            className="w-full bg-secondary/70 border border-border rounded p-1.5 text-xs text-foreground font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-muted-foreground font-mono block mb-1">
                            Frecuencia de Repetición
                          </label>
                          <select
                            value={formState.recurrence}
                            onChange={(e) =>
                              setFormState((s) => ({
                                ...s,
                                recurrence: e.target.value as any,
                              }))
                            }
                            className="w-full bg-secondary/70 border border-border rounded p-1.5 text-xs text-foreground font-mono"
                          >
                            <option value="ONCE">Una sola vez (Sin repetición)</option>
                            <option value="EVERY_6_HOURS">Cada 6 horas</option>
                            <option value="EVERY_12_HOURS">Cada 12 horas</option>
                            <option value="DAILY">Diario (Misma hora)</option>
                            <option value="WEEKLY">Semanal</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-muted-foreground font-mono block mb-1">
                          Nombre de la Campaña (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Anuncio Diario Canal VIP"
                          value={formState.campaignName}
                          onChange={(e) =>
                            setFormState((s) => ({ ...s, campaignName: e.target.value }))
                          }
                          className="w-full bg-secondary/70 border border-border rounded p-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rate Limit Pacing Notice */}
              <div className="p-2 rounded-lg bg-secondary/40 border border-border flex items-center gap-2 text-muted-foreground font-mono text-[10px]">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Pacing anti-flood activo: 1 seg entre canales para proteger tu cuenta de Telegram.</span>
              </div>
            </div>

            {/* Right Column: Live Telegram Post Simulator (5 cols) */}
            <div className="lg:col-span-5 space-y-2 sticky top-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase text-[11px]">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  Simulador de Telegram en Vivo
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">● En tiempo real</span>
              </div>

              {/* Telegram Simulated Chat Canvas */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#0e1621] border border-border/80 shadow-inner flex flex-col justify-start min-h-[380px] max-h-[500px] overflow-y-auto">
                <div className="text-[9px] font-mono text-center text-muted-foreground mb-2">
                  Hoy, {new Date().toLocaleDateString([], { month: "short", day: "numeric" })}
                </div>

                {/* Telegram Message Bubble */}
                <div className="rounded-2xl bg-[#182533] border border-white/5 p-3 space-y-2.5 shadow-xl w-full text-white animate-in fade-in">
                  {/* Channel Header inside Bubble */}
                  <div className="flex items-center gap-2 pb-1.5 border-b border-white/10">
                    {firstTarget ? (
                      <ChatAvatar
                        id={firstTarget.id}
                        title={firstTarget.title}
                        avatarColor={firstTarget.avatar_color}
                        className="w-6 h-6 rounded-md"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                        T
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-white truncate block">
                        {firstTarget?.title || "Canal de Telegram"}
                      </span>
                      <span className="text-[9px] text-cyan-400 font-mono">
                        {firstTarget?.type === "channel" ? "Canal" : "Grupo"}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Media Preview (Photo / Video / Album) */}
                  {formState.filePreviews.length > 0 && (
                    <div className="rounded-xl overflow-hidden bg-black/95 border border-white/10 aspect-video max-h-52 flex items-center justify-center relative shadow-md">
                      {formState.filePreviews[0].isVideo ? (
                        <video
                          src={formState.filePreviews[0].url}
                          controls
                          className="max-h-52 w-full object-contain"
                        />
                      ) : (
                        <img
                          src={formState.filePreviews[0].url}
                          alt="Vista previa"
                          className="max-h-52 w-full object-contain"
                        />
                      )}
                      {formState.filePreviews.length > 1 && (
                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-mono text-white border border-white/20">
                          1 de {formState.filePreviews.length} (Álbum)
                        </div>
                      )}
                    </div>
                  )}

                  {/* Formatted Text with Hashtags, Links and Mentions */}
                  <div className="text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed font-sans select-text break-words">
                    {formState.text.trim() ? (
                      formatTelegramText(formState.text)
                    ) : (
                      <span className="text-zinc-500 italic text-[11px] font-mono">
                        {formState.filePreviews.length > 0
                          ? "Multimedia sin texto"
                          : "Escribí tu mensaje o pegá texto promocional para verlo en vivo aquí..."}
                      </span>
                    )}
                  </div>

                  {/* Telegram Message Footer Receipt */}
                  <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-zinc-400 font-mono">
                    <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="text-primary font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
            Cerrar
          </Button>

          {formState.activeTab === "compose" ? (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={asyncState.isSubmitting || formState.selectedTargetIds.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 px-4 flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {asyncState.isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>
                    {formState.isScheduled
                      ? "Programando campaña..."
                      : `Difundiendo (${formState.selectedTargetIds.length})...`}
                  </span>
                </>
              ) : formState.isScheduled ? (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Programar Campaña ({formState.selectedTargetIds.length} canales)</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Difundir a {formState.selectedTargetIds.length} canales</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setFormState((s) => ({ ...s, activeTab: "compose" }))}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 px-4 flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Redactar Nueva Difusión</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
