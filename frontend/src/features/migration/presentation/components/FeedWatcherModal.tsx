import React, { useEffect, useState } from "react";
import {
  Radio,
  Play,
  RefreshCw,
  Trash2,
  Power,
  Plus,
  Sparkles,
  Scissors,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bot,
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
import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { SearchableChannelSelect } from "./SearchableChannelSelect";
import { Channel } from "@/features/migration/domain/types";
import {
  feedWatcherApi,
  FeedSourceItem,
  CreateFeedPayload,
} from "../../infrastructure/feedWatcherApi";

interface FeedWatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  selectedTargetId?: number | null;
}

interface FormState {
  title: string;
  sourceUrl: string;
  platform: string;
  targetChannelId: number;
  checkIntervalMinutes: number;
  aspectRatioMode: "9:16_BLUR" | "9:16_CROP" | "ORIGINAL";
  burnSubtitles: boolean;
  sliceStories: boolean;
  generateThumbnail: boolean;
  mode: "RESERVOIR" | "DIRECT";
}

interface UIState {
  feeds: FeedSourceItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  activePollingId: string | null;
  showCreateForm: boolean;
  feedback: { message: string; type: "success" | "error" } | null;
}

export const FeedWatcherModal: React.FC<FeedWatcherModalProps> = ({
  isOpen,
  onClose,
  channels,
  selectedTargetId,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Creation form configuration
  const [form, setForm] = useState<FormState>(() => ({
    title: "",
    sourceUrl: "",
    platform: "tiktok",
    targetChannelId: selectedTargetId || channels[0]?.id || 0,
    checkIntervalMinutes: 60,
    aspectRatioMode: "9:16_BLUR",
    burnSubtitles: true,
    sliceStories: true,
    generateThumbnail: true,
    mode: "RESERVOIR",
  }));

  // Hook 2: Feed list and modal state
  const [ui, setUi] = useState<UIState>({
    feeds: [],
    isLoading: false,
    isSubmitting: false,
    activePollingId: null,
    showCreateForm: false,
    feedback: null,
  });

  const loadFeeds = async () => {
    setUi((prev) => ({ ...prev, isLoading: true, feedback: null }));
    try {
      const res = await feedWatcherApi.list();
      setUi((prev) => ({ ...prev, feeds: res.feeds, isLoading: false }));
    } catch (err: any) {
      setUi((prev) => ({
        ...prev,
        isLoading: false,
        feedback: { message: err.message || "Error al cargar feeds", type: "error" },
      }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFeeds();
      if (selectedTargetId) {
        setForm((prev) => ({ ...prev, targetChannelId: selectedTargetId }));
      }
    }
  }, [isOpen, selectedTargetId]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sourceUrl.trim()) {
      setUi((prev) => ({
        ...prev,
        feedback: { message: "Ingresá la URL del perfil o canal a monitorear.", type: "error" },
      }));
      return;
    }
    if (!form.targetChannelId) {
      setUi((prev) => ({
        ...prev,
        feedback: { message: "Seleccioná un canal de Telegram de destino.", type: "error" },
      }));
      return;
    }

    setUi((prev) => ({ ...prev, isSubmitting: true, feedback: null }));
    try {
      const targetChan = channels.find((c) => c.id === form.targetChannelId);
      const payload: CreateFeedPayload = {
        title: form.title.trim() || `Feed ${form.platform.toUpperCase()}`,
        source_url: form.sourceUrl.trim(),
        platform: form.platform,
        target_channel_id: form.targetChannelId,
        target_channel_title: targetChan?.title,
        check_interval_minutes: form.checkIntervalMinutes,
        pipeline_config: {
          aspect_ratio_mode: form.aspectRatioMode,
          burn_subtitles: form.burnSubtitles,
          subtitle_style: "KINETIC_YELLOW",
          slice_stories: form.sliceStories,
          slice_dispatch_mode: "ALBUM",
          generate_thumbnail: form.generateThumbnail,
          mode: form.mode,
        },
      };

      await feedWatcherApi.create(payload);
      setForm((prev) => ({ ...prev, title: "", sourceUrl: "" }));
      setUi((prev) => ({
        ...prev,
        isSubmitting: false,
        showCreateForm: false,
        feedback: { message: "¡Feed registrado en Piloto Automático con éxito!", type: "success" },
      }));
      await loadFeeds();
    } catch (err: any) {
      setUi((prev) => ({
        ...prev,
        isSubmitting: false,
        feedback: { message: err.message || "Error al crear el feed", type: "error" },
      }));
    }
  };

  const handlePollNow = async (feedId: string) => {
    setUi((prev) => ({ ...prev, activePollingId: feedId, feedback: null }));
    try {
      const res = await feedWatcherApi.checkNow(feedId);
      const count = res.result?.ingested_count || 0;
      setUi((prev) => ({
        ...prev,
        activePollingId: null,
        feedback: {
          message: count > 0 ? `¡Sondeo exitoso! Se ingirieron ${count} videos nuevos.` : "Sondeo completo: no hay videos nuevos.",
          type: "success",
        },
      }));
      await loadFeeds();
    } catch (err: any) {
      setUi((prev) => ({
        ...prev,
        activePollingId: null,
        feedback: { message: err.message || "Error al sondear feed", type: "error" },
      }));
    }
  };

  const handleToggle = async (feedId: string) => {
    try {
      await feedWatcherApi.toggle(feedId);
      await loadFeeds();
    } catch (err: any) {
      setUi((prev) => ({
        ...prev,
        feedback: { message: err.message || "Error al alternar estado", type: "error" },
      }));
    }
  };

  const handleDelete = async (feedId: string) => {
    try {
      await feedWatcherApi.delete(feedId);
      await loadFeeds();
    } catch (err: any) {
      setUi((prev) => ({
        ...prev,
        feedback: { message: err.message || "Error al eliminar feed", type: "error" },
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Auto-Pilot Feed Watcher
                  <Badge variant="outline" className="text-[10px] text-pink-400 border-pink-500/30 font-mono">
                    DAEMON
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Monitoreo recurrente de creadores en TikTok, Reels y Shorts con autoposteo
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              variant={ui.showCreateForm ? "secondary" : "default"}
              onClick={() => setUi((prev) => ({ ...prev, showCreateForm: !prev.showCreateForm }))}
              className="text-xs h-8 gap-1.5 font-mono cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {ui.showCreateForm ? "Ver Monitoreados" : "Nuevo Feed"}
            </Button>
          </div>
        </DialogHeader>

        {/* Feedback Alert */}
        {ui.feedback && (
          <div
            className={`mx-4 mt-3 p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
              ui.feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {ui.feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span className="flex-1">{ui.feedback.message}</span>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {ui.showCreateForm ? (
            <form onSubmit={handleCreate} className="space-y-4 bg-card/40 p-4 rounded-xl border border-border">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Nombre del Feed / Creador:</label>
                  <Input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="ej. Viral Tech TikTok"
                    className="h-8 text-xs bg-secondary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Plataforma:</label>
                  <Select
                    value={form.platform}
                    onValueChange={(val) => setForm((prev) => ({ ...prev, platform: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-secondary/50 border-border">
                      <SelectValue placeholder="Seleccionar plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="youtube">YouTube Shorts</SelectItem>
                      <SelectItem value="instagram">Instagram Reels</SelectItem>
                      <SelectItem value="web">Genérico / Web</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">URL del Perfil o Canal Fuente:</label>
                <Input
                  type="url"
                  value={form.sourceUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                  placeholder="https://www.tiktok.com/@creator o https://www.youtube.com/@channel/shorts"
                  className="h-8 text-xs font-mono bg-secondary/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Canal de Telegram Destino:</label>
                  <SearchableChannelSelect
                    value={form.targetChannelId || null}
                    onChange={(id) => {
                      setForm((prev) => ({
                        ...prev,
                        targetChannelId: id || 0,
                      }));
                    }}
                    channels={channels}
                    placeholder="Buscar canal destino..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Intervalo de Chequeo:</label>
                  <Select
                    value={String(form.checkIntervalMinutes)}
                    onValueChange={(val) => setForm((prev) => ({ ...prev, checkIntervalMinutes: Number(val) }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-secondary/50 border-border">
                      <SelectValue placeholder="Intervalo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">Cada 15 minutos</SelectItem>
                      <SelectItem value="30">Cada 30 minutos</SelectItem>
                      <SelectItem value="60">Cada 1 hora</SelectItem>
                      <SelectItem value="120">Cada 2 horas</SelectItem>
                      <SelectItem value="360">Cada 6 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pipeline Auto-Flags */}
              <div className="p-3.5 rounded-lg border border-border bg-secondary/20 space-y-3">
                <span className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider block">
                  Pipeline Automático de Procesamiento:
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-card/60 border border-border/60">
                    <span className="text-xs font-medium text-foreground">9:16 Vertical (Stories/Blur)</span>
                    <Switch
                      checked={form.aspectRatioMode === "9:16_BLUR"}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          aspectRatioMode: checked ? "9:16_BLUR" : "ORIGINAL",
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-md bg-card/60 border border-border/60">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      Subtítulos Cinéticos
                    </span>
                    <Switch
                      checked={form.burnSubtitles}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, burnSubtitles: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-md bg-card/60 border border-border/60">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-amber-400" />
                      Slicer 60s (Álbum)
                    </span>
                    <Switch
                      checked={form.sliceStories}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, sliceStories: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-md bg-card/60 border border-border/60">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      Goteo en Reservorio
                    </span>
                    <Switch
                      checked={form.mode === "RESERVOIR"}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          mode: checked ? "RESERVOIR" : "DIRECT",
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUi((prev) => ({ ...prev, showCreateForm: false }))}
                  className="h-8 text-xs cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={ui.isSubmitting}
                  className="h-8 text-xs bg-pink-600 hover:bg-pink-500 font-semibold cursor-pointer"
                >
                  {ui.isSubmitting ? "Registrando..." : "Guardar y Activar Auto-Pilot"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {ui.isLoading ? (
                <div className="text-center py-10 text-muted-foreground text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-pink-400" />
                  Cargando feeds monitoreados...
                </div>
              ) : ui.feeds.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl space-y-2">
                  <Radio className="w-8 h-8 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-semibold text-foreground">No hay feeds en piloto automático</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Conectá perfiles de TikTok o YouTube Shorts para que el sistema descargue, procese y publique automáticamente.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setUi((prev) => ({ ...prev, showCreateForm: true }))}
                    className="mt-2 text-xs h-8 bg-pink-600 hover:bg-pink-500 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Registrar Primer Feed
                  </Button>
                </div>
              ) : (
                ui.feeds.map((feed) => {
                  const isPolling = ui.activePollingId === feed.id;
                  return (
                    <div
                      key={feed.id}
                      className="p-3.5 rounded-xl border border-border bg-card/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-pink-500/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground truncate">{feed.title}</span>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] font-mono px-1.5 py-0 ${
                              feed.is_active
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                            }`}
                          >
                            {feed.is_active ? "ACTIVO" : "PAUSADO"}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] uppercase font-mono">
                            {feed.platform}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                          {feed.source_url}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                          <span>🎯 Canal: {feed.target_channel_title || feed.target_channel_id}</span>
                          <span>⏱️ Cada {feed.check_interval_minutes}m</span>
                          <span>📦 Ingestados: {feed.total_ingested}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPolling}
                          onClick={() => handlePollNow(feed.id)}
                          className="h-7 text-xs font-mono px-2.5 gap-1 cursor-pointer border-border hover:border-pink-400"
                        >
                          <Play className={`w-3 h-3 text-pink-400 ${isPolling ? "animate-spin" : ""}`} />
                          {isPolling ? "Sondeando..." : "Sondear"}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggle(feed.id)}
                          className={`h-7 w-7 p-0 cursor-pointer ${
                            feed.is_active ? "text-emerald-400" : "text-muted-foreground"
                          }`}
                          title={feed.is_active ? "Pausar feed" : "Activar feed"}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(feed.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 cursor-pointer"
                          title="Eliminar feed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-border bg-card/60 flex items-center justify-between">
          <span className="text-[11px] font-mono text-muted-foreground">
            {ui.feeds.length} feeds configurados
          </span>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-7 cursor-pointer">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
